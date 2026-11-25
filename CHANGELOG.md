# @linked.cm/zoho-cpaas

## 0.2.0

### Minor Changes

- [#4](https://github.com/linked-cm/zoho-cpaas/pull/4) [`fad5945`](https://github.com/linked-cm/zoho-cpaas/commit/fad5945028e22573806458b9cfdd03a36ff5bee4) Thanks [@flyon](https://github.com/flyon)! - Requires `@_linked/core` 3 and `@_linked/server-utils` 2. The package identity no longer destructures `linkedOntology`, which core 3 removed (ontologies register through `linkedOntologies`/`registerOntologies`; this package declares none).

## 0.1.1

### Patch Changes

- [#2](https://github.com/linked-cm/zoho-cpaas/pull/2) [`194844b`](https://github.com/linked-cm/zoho-cpaas/commit/194844b990e8e30f6340a848072a8ed1b2c19d7d) Thanks [@flyon](https://github.com/flyon)! - Ship the TypeScript sources inside the sourcemaps (`inlineSources`), so tools reading the maps no longer report missing source files.
