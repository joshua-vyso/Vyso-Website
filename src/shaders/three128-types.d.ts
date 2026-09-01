/* Route the `three128` npm alias (three@0.128.0, see package.json) onto the
   r128 type surface. The alias exists for the registered ThreeUI dock field
   `src/shaders/animated-top-dock/glassParticleField.ts`, which imports the
   bare specifier `three128`; the module is behind a variant-gated dynamic
   import and is never fetched by the variants this site mounts. */
declare module "three128" {
  export * from "types-three128";
}
