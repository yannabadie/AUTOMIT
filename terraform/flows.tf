# Deploy all Kestra flows from YAML files via Terraform
# This replaces the volume mount approach (./kestra/flows:/app/flows)
# and provides proper state management + GitOps workflow.

resource "kestra_flow" "flows" {
  for_each             = fileset("${path.module}/../kestra/flows", "**/*.yml")
  keep_original_source = true
  flow_id              = yamldecode(file("${path.module}/../kestra/flows/${each.value}"))["id"]
  namespace            = yamldecode(file("${path.module}/../kestra/flows/${each.value}"))["namespace"]
  content              = file("${path.module}/../kestra/flows/${each.value}")
}
