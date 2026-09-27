// @ts-check
import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

const LAYERS = ['domain', 'application', 'infrastructure', 'presentation']

/** Same bounded context as the importing file. */
const sameModule = (...types) => ({
  element: { type: types, captured: { module: '{{ from.element.captured.module }}' } },
})
/** Another module, only through its public API (`index.ts`). */
const otherModulePublicApi = {
  element: {
    type: 'module',
    captured: { module: '!{{ from.element.captured.module }}' },
    fileInternalPath: 'index.ts',
  },
}
const shared = (...layers) => ({ element: { type: layers.map((l) => `shared-${l}`) } })

/** Libraries the inner layers must not know (docs/arquitetura.md §7). */
const INFRASTRUCTURE_LIBRARIES = [
  '@nestjs/*',
  '@prisma/*',
  '@scalar/*',
  '@upstash/*',
  '@vercel/*',
  'bcrypt',
  'bcryptjs',
  'cloudinary',
  'express',
  'helmet',
  'nestjs-zod',
  'passport',
  'passport-*',
  'pg',
  'resend',
  'zod',
  'zod/*',
]

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'src/generated/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Dependency rule and module boundaries (docs/arquitetura.md §3 and §7).
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/legacy-templates': false,
      // main.ts, app.module.ts...: the application's composition root, like *.module.ts.
      'boundaries/ignore': ['src/*.ts'],
      'boundaries/elements': [
        ...LAYERS.map((layer) => ({
          type: layer,
          pattern: `src/modules/*/${layer}`,
          capture: ['module'],
        })),
        // index.ts and *.module.ts: public API and composition root of the module.
        { type: 'module', pattern: 'src/modules/*', capture: ['module'] },
        ...LAYERS.map((layer) => ({
          type: `shared-${layer}`,
          pattern: `src/shared/${layer}`,
        })),
        { type: 'generated', pattern: 'src/generated' },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { allow: { to: { module: { origin: ['external', 'core'] } } } },
            {
              from: { element: { type: 'domain' } },
              allow: { to: [sameModule('domain'), shared('domain')] },
            },
            {
              from: { element: { type: 'application' } },
              allow: {
                to: [
                  sameModule('domain', 'application'),
                  otherModulePublicApi,
                  shared('domain', 'application'),
                ],
              },
            },
            {
              from: { element: { type: 'infrastructure' } },
              allow: {
                to: [
                  sameModule('domain', 'application', 'infrastructure'),
                  otherModulePublicApi,
                  shared('domain', 'application', 'infrastructure'),
                  { element: { type: 'generated' } },
                ],
              },
            },
            {
              from: { element: { type: 'presentation' } },
              allow: {
                to: [
                  sameModule('domain', 'application', 'presentation'),
                  otherModulePublicApi,
                  shared('domain', 'application', 'presentation'),
                ],
              },
            },
            {
              from: { element: { type: 'module' } },
              allow: {
                to: [sameModule(...LAYERS, 'module'), otherModulePublicApi, shared(...LAYERS)],
              },
            },
            {
              from: { element: { type: 'shared-domain' } },
              allow: { to: shared('domain') },
            },
            {
              from: { element: { type: 'shared-application' } },
              allow: { to: shared('domain', 'application') },
            },
            {
              from: { element: { type: 'shared-infrastructure' } },
              allow: {
                to: [
                  shared('domain', 'application', 'infrastructure'),
                  { element: { type: 'generated' } },
                ],
              },
            },
            {
              from: { element: { type: 'shared-presentation' } },
              allow: { to: shared('domain', 'application', 'presentation') },
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/modules/*/domain/**/*.ts',
      'src/modules/*/application/**/*.ts',
      'src/shared/domain/**/*.ts',
      'src/shared/application/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: INFRASTRUCTURE_LIBRARIES,
              message:
                'domain/ e application/ não dependem de framework nem de infraestrutura: declare um port e implemente em infrastructure/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
)
