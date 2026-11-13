// Built against the stable MCP Apps specification, revision 2026-01-26, at
// Specification/2026-01-26/apps.mdx in github.com/modelcontextprotocol/ext-apps.
const protocolVersion = "2026-01-26";

// The only resource type the specification defines; a host refuses a ui:// resource of any other type.
const htmlMimeType = "text/html;profile=mcp-app";

// The flat key the specification deprecates in favour of _meta.ui.resourceUri. Hosts released before the change read
// Only this one, so a tool carries both until the key is removed.
const legacyResourceUriKey = "ui/resourceUri";

export { htmlMimeType, legacyResourceUriKey, protocolVersion };
