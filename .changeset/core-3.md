---
"@linked.cm/zoho-cpaas": minor
---

Requires `@_linked/core` 3 and `@_linked/server-utils` 2. The package identity no longer destructures `linkedOntology`, which core 3 removed (ontologies register through `linkedOntologies`/`registerOntologies`; this package declares none).
