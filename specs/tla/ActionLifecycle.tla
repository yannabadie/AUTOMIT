--------------------------- MODULE ActionLifecycle ---------------------------
\* AutomIT Action Lifecycle — Formal specification
\* Defines the valid state transitions for IT automation actions
\* with tier-based approval requirements.

EXTENDS Integers, Sequences, FiniteSets

CONSTANTS
    Tiers,          \* {0, 1, 2, 3}
    Actions,        \* Set of action IDs
    Targets,        \* Set of target IDs
    Technicians,    \* Set of technician IDs
    Approvers       \* Set of approver IDs

VARIABLES
    state,          \* action_id -> state (proposed, approved, executing, completed, failed, rolled_back, expired)
    tier,           \* action_id -> tier level
    requestor,      \* action_id -> technician ID
    approver,       \* action_id -> approver ID (or NULL)
    approver2,      \* action_id -> second approver ID for dual approval (or "none")
    action_target,  \* action_id -> target ID bound during execution (or "none")
    target_locks,   \* target_id -> action_id currently executing (or NULL)
    emergency_stop  \* boolean

vars == << state, tier, requestor, approver, approver2, action_target, target_locks, emergency_stop >>

States == {"proposed", "approved", "executing", "completed", "failed", "rolled_back", "expired"}

TypeInvariant ==
    /\ state \in [Actions -> States \cup {"idle"}]
    /\ tier \in [Actions -> Tiers \cup {-1}]
    /\ requestor \in [Actions -> Technicians \cup {"none"}]
    /\ approver \in [Actions -> Approvers \cup {"none"}]
    /\ approver2 \in [Actions -> Approvers \cup {"none"}]
    /\ action_target \in [Actions -> Targets \cup {"none"}]
    /\ target_locks \in [Targets -> Actions \cup {"none"}]
    /\ emergency_stop \in BOOLEAN

Init ==
    /\ state = [a \in Actions |-> "idle"]
    /\ tier = [a \in Actions |-> -1]
    /\ requestor = [a \in Actions |-> "none"]
    /\ approver = [a \in Actions |-> "none"]
    /\ approver2 = [a \in Actions |-> "none"]
    /\ action_target = [a \in Actions |-> "none"]
    /\ target_locks = [t \in Targets |-> "none"]
    /\ emergency_stop = FALSE

\* --- Actions ---

\* Propose an action (any technician, any tier)
Propose(a, t, tech) ==
    /\ state[a] = "idle"
    /\ ~emergency_stop
    /\ t \in Tiers
    /\ tech \in Technicians
    /\ state' = [state EXCEPT ![a] = "proposed"]
    /\ tier' = [tier EXCEPT ![a] = t]
    /\ requestor' = [requestor EXCEPT ![a] = tech]
    /\ UNCHANGED << approver, approver2, action_target, target_locks, emergency_stop >>

\* Auto-approve Tier 0-1 (no human approval needed)
AutoApprove(a) ==
    /\ state[a] = "proposed"
    /\ tier[a] \in {0, 1}
    /\ state' = [state EXCEPT ![a] = "approved"]
    /\ UNCHANGED << tier, requestor, approver, approver2, action_target, target_locks, emergency_stop >>

\* Human approval for Tier 2-3 (GLPI CommonITILValidation)
HumanApprove(a, app) ==
    /\ state[a] = "proposed"
    /\ tier[a] \in {2, 3}
    /\ app \in Approvers
    /\ app # requestor[a]  \* Cannot self-approve
    /\ state' = [state EXCEPT ![a] = "approved"]
    /\ approver' = [approver EXCEPT ![a] = app]
    /\ UNCHANGED << tier, requestor, approver2, action_target, target_locks, emergency_stop >>

\* Dual approval for Tier 3 (second approval via Kestra break-glass)
\* Modeled as requiring HumanApprove to have happened first
DualApprove(a, app2) ==
    /\ state[a] = "approved"
    /\ tier[a] = 3
    /\ app2 \in Approvers
    /\ app2 # approver[a]  \* Different from first approver
    /\ app2 # requestor[a] \* Different from requestor
    \* State stays approved but with second approver recorded
    /\ approver2' = [approver2 EXCEPT ![a] = app2]
    /\ UNCHANGED << state, tier, requestor, approver, action_target, target_locks, emergency_stop >>

\* Begin execution (lock target)
BeginExecute(a, tgt) ==
    /\ state[a] = "approved"
    /\ target_locks[tgt] = "none"  \* No concurrent execution on same target
    /\ ~emergency_stop
    /\ state' = [state EXCEPT ![a] = "executing"]
    /\ action_target' = [action_target EXCEPT ![a] = tgt]
    /\ target_locks' = [target_locks EXCEPT ![tgt] = a]
    /\ UNCHANGED << tier, requestor, approver, approver2, emergency_stop >>

\* Complete execution (release lock)
Complete(a, tgt) ==
    /\ state[a] = "executing"
    /\ action_target[a] = tgt
    /\ target_locks[tgt] = a
    /\ state' = [state EXCEPT ![a] = "completed"]
    /\ target_locks' = [target_locks EXCEPT ![tgt] = "none"]
    /\ UNCHANGED << tier, requestor, approver, approver2, action_target, emergency_stop >>

\* Fail execution (release lock)
Fail(a, tgt) ==
    /\ state[a] = "executing"
    /\ action_target[a] = tgt
    /\ target_locks[tgt] = a
    /\ state' = [state EXCEPT ![a] = "failed"]
    /\ target_locks' = [target_locks EXCEPT ![tgt] = "none"]
    /\ UNCHANGED << tier, requestor, approver, approver2, action_target, emergency_stop >>

\* Rollback (from completed state only)
Rollback(a) ==
    /\ state[a] = "completed"
    /\ target_locks[action_target[a]] = "none"
    /\ state' = [state EXCEPT ![a] = "rolled_back"]
    /\ UNCHANGED << tier, requestor, approver, approver2, action_target, target_locks, emergency_stop >>

\* Expire (from proposed state only)
Expire(a) ==
    /\ state[a] = "proposed"
    /\ state' = [state EXCEPT ![a] = "expired"]
    /\ UNCHANGED << tier, requestor, approver, approver2, action_target, target_locks, emergency_stop >>

\* Emergency stop (blocks all new executions)
EmergencyStopOn ==
    /\ ~emergency_stop
    /\ emergency_stop' = TRUE
    /\ UNCHANGED << state, tier, requestor, approver, approver2, action_target, target_locks >>

EmergencyStopOff ==
    /\ emergency_stop
    /\ emergency_stop' = FALSE
    /\ UNCHANGED << state, tier, requestor, approver, approver2, action_target, target_locks >>

\* --- Next state ---

Next ==
    \/ \E a \in Actions, t \in Tiers, tech \in Technicians : Propose(a, t, tech)
    \/ \E a \in Actions : AutoApprove(a)
    \/ \E a \in Actions, app \in Approvers : HumanApprove(a, app)
    \/ \E a \in Actions, app2 \in Approvers : DualApprove(a, app2)
    \/ \E a \in Actions, tgt \in Targets : BeginExecute(a, tgt)
    \/ \E a \in Actions, tgt \in Targets : Complete(a, tgt)
    \/ \E a \in Actions, tgt \in Targets : Fail(a, tgt)
    \/ \E a \in Actions : Rollback(a)
    \/ \E a \in Actions : Expire(a)
    \/ EmergencyStopOn
    \/ EmergencyStopOff

Spec == Init /\ [][Next]_vars

\* --- Safety invariants ---

\* No Tier 2+ action can be executing without having been approved by someone other than requestor
NoUnapprovedTier2 ==
    \A a \in Actions :
        (state[a] = "executing" /\ tier[a] >= 2) =>
            (approver[a] # "none" /\ approver[a] # requestor[a])

\* No two actions can execute on the same target simultaneously
NoTargetConflict ==
    \A t \in Targets :
        target_locks[t] # "none" =>
            Cardinality({a \in Actions : state[a] = "executing" /\ target_locks[t] = a}) = 1

\* Emergency stop prevents new executions (action constraint)
EmergencyStopBlocksExecution ==
    \A a \in Actions :
        (emergency_stop /\ state[a] # "executing") => state'[a] # "executing"

\* Terminal states are truly terminal (action constraint)
TerminalStatesStable ==
    \A a \in Actions :
        (/\ state[a] \in {"failed", "rolled_back", "expired"}
            => state'[a] = state[a])
        /\ (state[a] = "completed"
            => state'[a] \in {"completed", "rolled_back"})

=============================================================================
