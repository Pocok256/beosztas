# 000-aibd-architecture.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/000-aibd-architecture.mdc

---
description: AIBD Architecture
globs: 
alwaysApply: true
---

# AIBD Architecture

This document outlines our application's architectural principles and structure. It focuses on how code is organized at a high level, how components interact, and how to maintain clear boundaries between different parts of the application.

## Directory Structure Restrictions

To maintain clarity and consistency across the codebase, we enforce these directory structure restrictions:

1. **No New Directories in `/src`**:
   - Only use the established directories: `features`, `shared`
   - Do not create additional top-level directories in the src folder

2. **No Subdirectories in Feature or Shared Directories**:
   - Feature directories (`/src/features/feature-name/`) and shared directories (`/src/shared/shared-name/`) must only contain:
     - Public files in the root
     - A single `internal` directory for private code
     - The required `prd.md` file
   - No additional subdirectories are allowed at the feature or shared directory root level

3. **Internal Directory Structure**:
   - The `internal` directory can contain subdirectories as needed
   - Organize complex internal code with appropriate subdirectories

4. **No Barrel Files**:
   - Do not use barrel files (index.ts) that re-export from other files
   - Import directly from the source file instead

Examples:

```
// ❌ DON'T - Create a barrel index.ts file that re-exports
// index.ts
export { UserProfile } from './UserProfile';
export { UserSettings } from './UserSettings';

// ❌ DON'T - Import from a barrel file
import { UserProfile, UserSettings } from './user-management';

// ✅ DO - Import directly from the source file
import { UserProfile } from './user-management/UserProfile';
import { UserSettings } from './user-management/UserSettings';
```

## Feature-Based Organization

Feature-based organization ensures that related code stays together and maintains clear boundaries. This structure supports independent development and makes the codebase easier to navigate and maintain.

### Directory Structure

Each feature represents a discrete, cohesive piece of functionality with clear boundaries and responsibilities. Features follow a consistent structure defined in these guidelines, with specific implementations guided by the appropriate blueprint based on the feature type. Features are organized in self-contained directories under `/src/features/` and are the primary organizational unit of our architecture.

The feature directory structure follows these principles:

- Each file should contain only one declaration, with this exception:
  - A function and its parameter type must be in the same file
  - Example: `validateUser.ts` can contain `ValidateUserParams` type, and `validateUser` function
- Feature directories use kebab-case naming (e.g., `user-management`)
- Public declarations go in the feature root directory
- All private code must be placed in a single `internal` directory at the feature root level
  - All private types, utilities, and services go directly in the `internal` directory
- Each feature must contain a `prd.md` document

Example of a properly structured feature directory:

```
src/
└── features/
    ├── user-management/
    │   ├── prd.md                    # Product Requirements Document (PRD)
    │   ├── UserProfile.ts            # Public - can be imported from other features
    │   ├── UserSettings.ts           # Public - can be imported from other features
    │   └── internal/                 # Private - contains all feature-private code
    │       ├── Theme.ts              # Internal types
    │       ├── UserData.ts           # Internal types
    │       ├── validateEmail.ts      # Internal utilities
    │       └── UserValidator.ts      # Internal services
    └── payment-processing/
        ├── prd.md                    # Product Requirements Document (PRD)
        ├── PaymentMethod.ts          # Public - can be imported from other features
        └── internal/                 # Private - contains all feature-private code
            ├── Payment.ts            # Internal types
            ├── PaymentDetails.ts     # Internal types
            └── validatePayment.ts    # Internal services
```

### Feature Documentation

Each feature must include a `prd.md` file in its root directory. This document serves as the single source of truth for the feature's business and technical requirements, ensuring alignment between product, design, and engineering.

A valid `prd.md` must include the following sections, in this order:

1. **Title**
   - `# Product Requirements Document (PRD)`
2. **Feature Name**
   - `## Feature: <Feature Name>`
3. **Objective**
   - A concise statement describing the purpose and business value of the feature.
4. **User Stories**
   - A bulleted list of user stories, each starting with "As a <role>, I want <goal> so that <reason>."
5. **Requirements**
   - **Functional:** Numbered list of functional requirements, grouped by subtopic if needed (e.g., Form Fields, Validation, Submission, Security).
   - **Non-Functional:** Bulleted list of non-functional requirements (e.g., performance, responsiveness, styling, testing).
6. **Acceptance Criteria**
   - Checklist of criteria that must be met for the feature to be considered complete. Each should be testable and map to requirements/user stories.
7. **Out of Scope**
   - Bulleted list of items explicitly not included in this feature.

Features should follow the specific guidance provided in the relevant blueprint based on their type (UI component, MCP tool, etc.). Blueprints provide specialized implementation patterns and requirements for different types of features while maintaining the consistent structure defined in these guidelines.

## Dependency Management

Clear dependency rules prevent unwanted coupling between features and make the codebase easier to maintain and modify.

### Cross-Feature Dependencies

Features must follow these dependency rules:

1. Features can only import from other features' root directory using path aliases
2. Importing from subdirectories of other features is forbidden
3. Only the `internal` subdirectory is allowed within a feature, and it must be imported using relative paths
4. The `internal` directory of a feature is strictly private and should never be imported from outside the feature

Examples:

```typescript
// ✅ DO - Importing public declarations from another feature using path aliases
import type { UserProfile } from "@features/user-management/UserProfile";

// ❌ DON'T - Using relative paths for cross-feature imports
import type { UserProfile } from "../user-management/UserProfile";

// ❌ DON'T - Importing from internal directory of another feature
import type { Theme } from "@features/user-management/internal/Theme";

// ✅ DO - Importing from internal directory within the same feature using relative paths
import type { Theme } from "./internal/Theme";

// ❌ DON'T - Using path aliases for imports within the same feature
import type { Theme } from "@features/current-feature/internal/Theme";
```

### Dependency Structure

Features should form a directed acyclic graph (DAG):

1. Higher-level features can depend on lower-level features
2. Lower-level features cannot depend on higher-level features
3. No circular dependencies between features

## Shared Code Organization

Shared code requires careful organization to prevent inappropriate coupling while promoting code reuse.

### Shared Directory Structure

Common, reusable code lives in a dedicated `shared` directory. There are three key patterns for shared code:

#### 1. Shared Utilities and Types

Utilities and types are organized in subdirectories by domain:

```
src/
└── shared/
    ├── types/                # Shared types
    │   ├── Result.ts
    │   ├── Nullable.ts
    │   └── CommonId.ts
    ├── utils/                # Pure utility functions
    │   ├── formatDate.ts
    │   ├── validateEmail.ts
    │   └── createId.ts
    ├── http/                 # HTTP utilities
    │   ├── HttpClient.ts
    │   ├── HttpError.ts
    │   └── createHeaders.ts
    └── validation/           # Validation utilities
        ├── ValidationResult.ts
        ├── validateRequired.ts
        └── validateLength.ts
```

#### 2. Shared UI Components

Shared UI components follow the same structure as features but are placed at the top level of the shared directory with a `-ui` suffix:

```
src/
└── shared/
    ├── resource-form-ui/                # Resource form UI component
    │   ├── prd.md                       # PRD for component
    │   ├── ResourceFormUi.tsx           # Main component
    │   └── internal/                    # Private code
    │       ├── validateResourceForm.ts
    │       └── ResourceFieldsUi.tsx
    │
    ├── confirmation-dialog-ui/          # Confirmation dialog UI component
    │   ├── prd.md
    │   ├── ConfirmationDialogUi.tsx
    │   └── internal/
    │       └── useConfirmationDialog.ts
    │
    └── data-table-ui/                   # Data table UI component
        ├── prd.md
        ├── DataTableUi.tsx
        └── internal/
            ├── SortingUi.tsx
            └── PaginationUi.tsx
```

#### 3. Shared Features

For business logic that needs to be shared across multiple features, create a shared feature at the top level of the shared directory:

```
src/
└── shared/
    └── resource-validation/            # Shared feature for resource validation
        ├── prd.md                      # PRD for shared feature
        ├── validateResource.ts         # Public API
        ├── ResourceValidationRules.ts  # Public API
        └── internal/                   # Private code
            ├── validateResourceTitle.ts
            ├── validateResourceImage.ts
            └── ResourceValidator.ts
```

### Shared Code Criteria

Code belongs in `shared` when it:

1. Is used by multiple features
2. Has no feature-specific dependencies
3. Is generic and technical in nature
4. Represents cross-cutting concerns

Keep code in features when it:

1. Is only used by one feature
2. Contains business logic specific to one feature
3. Is likely to change with feature requirements
4. Has feature-specific dependencies

### Shared UI Component Criteria

A UI component belongs in `shared/<component-name>-ui/` when:

1. It is used by multiple features
2. It is purely presentational with no business logic
3. It has a clear, focused responsibility
4. It needs proper documentation (PRD)

### Shared Feature Criteria 

A feature belongs in `shared/<feature-name>/` when:

1. It contains business logic used by multiple features
2. It represents a domain concept shared across features
3. It needs to be maintained as a cohesive unit
4. It needs proper documentation (PRD)

### Import Rules for Shared Code

When importing from shared code:

1. Always use path aliases for shared imports
2. Never import from the internal directory of a shared component/feature
3. Each shared UI component and feature must have its own PRD and follow the same structure as regular features

Examples:

```typescript
// ✅ DO - Importing from shared using path aliases
import { ResourceFormUi } from "@shared/resource-form-ui/ResourceFormUi";
import { validateResource } from "@shared/resource-validation/validateResource";

// ❌ DON'T - Importing from internal directory of shared code
import { validateResourceTitle } from "@shared/resource-validation/internal/validateResourceTitle";
```

---

# 001-aibd-ts.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/001-aibd-ts.mdc

---
description: AIBD TypeScript Coding Guidelines - File Naming and Organization
globs: 
alwaysApply: true
---
# AIBD TypeScript Coding Guidelines

## File Naming and Organization

Consistent file naming makes code easier to find and understand. Clear organization within files helps developers quickly comprehend code structure.

### File Naming Conventions

Files should follow these naming rules:

- One declaration per file
- File name matches the declaration name exactly
- Use `.ts` extension for all TypeScript files
- Use appropriate casing:
  - PascalCase for:
    - Types representing objects
    - Classes
    - Namespaces
    - Enums
  - camelCase for:
    - Function types
    - Variable declarations
    - Function declarations

Examples:

```
UserProfile.ts        // Contains type or class UserProfile
formatDate.ts         // Contains function formatDate
HttpClient.ts         // Contains class HttpClient
ValidationResult.ts   // Contains type ValidationResult
```

### Variable Documentation

Use TSDoc to document variables. For multiple declarations, always split them into separate declarations to enable proper documentation:

```typescript
// ❌ DON'T use inline documentation for multiple declarations
/** First counter */ let count1, /** Second counter */ count2;

// ✅ DO split declarations for proper documentation
/** First counter used for tracking primary iterations */
let count1: number;

/** Second counter used for nested loop iterations */
let count2: number;
```

Common TSDoc tags for variables:

- `@defaultValue` - Documents default value
- `@deprecated` - Marks as deprecated
- `@remarks` - Adds additional details
- `@see` - References related code
- `@since` - Version when introduced

---

# 002-aibd-ts-types.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/002-aibd-ts-types.mdc

---
description: AIBD TypeScript Coding Guidelines - Type Declarations
globs: 
alwaysApply: true
---

# AIBD TypeScript Coding Guidelines

## Type Declarations

Use type aliases instead of interfaces for better consistency and flexibility. Type aliases provide all the capabilities of interfaces while being more flexible and having clearer syntax for complex types.

```typescript
// ❌ DON'T use interfaces
interface User {
  id: number;
  name: string;
}

// ✅ DO use type aliases
type User = {
  id: number;
  name: string;
};
```

### Explicit Types

Always use explicit type annotations for:

- Function parameters
- Function return types
- Variable declarations
- Class properties

```typescript
// ❌ DON'T rely on type inference
const userData = {
  id: 1,
  name: "John",
};

function processUser(user) {
  return user.id;
}

// ✅ DO use explicit type annotations
type User = {
  id: number;
  name: string;
};

const userData: User = {
  id: 1,
  name: "John",
};

function processUser(user: User): number {
  return user.id;
}
```

Exceptions allowed for:

1. Loop variables in simple `for` loops
2. Variables with literal values when literal type is desired
3. Object destructuring in typed function parameters

```typescript
// Acceptable exceptions:
for (let i = 0; i < 10; i++) {
  /* ... */
}

const TIMEOUT = 1000; // Literal type is desired

function process({ id, name }: User): void {
  /* ... */
}
```

### Type Documentation

Document types using TSDoc comments. For complex types, document both the type itself and its properties:

```typescript
/**
 * Represents a user in the system
 * @see UserService for CRUD operations
 */
type User = {
  /** Unique identifier for the user */
  id: number;
  /** Full display name of the user */
  name: string;
  /**
   * User's email address
   * @deprecated Use `contactInfo.email` instead
   */
  email: string;
  /**
   * User's preference settings
   * @defaultValue `{ theme: 'light', notifications: true }`
   */
  preferences: UserPreferences;
};
```

Common TSDoc tags for types:

- `@deprecated` - Marks type or property as deprecated
- `@remarks` - Adds additional details
- `@see` - References related code
- `@since` - Version when introduced
- `@defaultValue` - Documents default value (for properties)
- `@example` - Provides usage examples

````

Note: The `@type` tag is not needed in TypeScript as the type information is already provided by type annotations.

## Variable Declarations

Clear and consistent variable declarations improve code readability and prevent common errors.

### Single Variable Per Declaration

Always declare each variable separately:

```typescript
// ❌ DON'T declare multiple variables in one statement
let a, b;
let x = 1,
  y = 2;

// ✅ DO declare each variable separately
let a: number;
let b: string;

let x = 1;
let y = 2;
````

### Type Imports

Always use `import type` for type-only imports:

```typescript
// ❌ DON'T use regular imports for types
import { UserProfile } from "./UserProfile";
import { PaymentMethod } from "./PaymentMethod";

// ✅ DO use import type for type-only imports
import type { UserProfile } from "./UserProfile";
import type { PaymentMethod } from "./PaymentMethod";

// ✅ DO use regular imports for values/functions
import { validateUser } from "./validateUser";
import { processPayment } from "./processPayment";
```

This practice:

1. Separates runtime from compile-time dependencies
2. Improves tree-shaking
3. Makes circular dependencies easier to spot

Configure ESLint to enforce this:

```json
{
  "rules": {
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        "prefer": "type-imports",
        "disallowTypeAnnotations": true
      }
    ]
  }
}
```

### Type Guards

Implement type guards to safely work with union type results:

```typescript
// Type guard for checking if result is an error
function isError(result: unknown): result is Error {
  return result instanceof Error;
}

// Usage example
async function displayUserProfile(userId: string): Promise<void> {
  const result = await fetchUser(userId);
  
  if (isError(result)) {
    // Handle error case
    console.error(`Failed to load user: ${result.message}`);
    // Display error notification to user
    return;
  }
  
  // Safe to use result as User here
  console.log(`Loaded profile for ${result.name}`);
}
```

---

# 003-aibd-ts-function.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/003-aibd-ts-function.mdc

---
description: AIBD TypeScript Coding Guidelines - Function Declarations
globs: 
alwaysApply: true
---

# AIBD TypeScript Coding Guidelines

## Function Declarations

### Function Parameters

Prefer functions with a single parameter. When multiple parameters are needed, pass them as a single object with a type alias following the naming convention: `functionName` => `type functionNameParams`:

```typescript
// ❌ DON'T use multiple parameters
function validateUser(
  email: string,
  age: number,
  preferences: UserPreferences
): ValidationResult {
  // Implementation
}

// ✅ DO use a single object parameter with a clear type alias
type ValidateUserParams = {
  email: string;
  age: number;
  preferences: UserPreferences;
};

function validateUser(params: ValidateUserParams): ValidationResult {
  const { email, age, preferences } = params;
  // Implementation
}
```

### Avoid Nested Functions

Keep functions at the top level:

```typescript
// ❌ DON'T nest named functions
function processUserData(data: User): void {
  function validateEmail(): boolean {
    return data.email.includes("@");
  }

  function formatName(): string {
    return data.name.toUpperCase();
  }

  if (validateEmail()) {
    console.log(formatName());
  }
}

// ✅ DO keep functions at the top level
function validateEmail(email: string): boolean {
  return email.includes("@");
}

function formatName(name: string): string {
  return name.toUpperCase();
}

function processUserData(data: User): void {
  if (validateEmail(data.email)) {
    console.log(formatName(data.name));
  }
}
```

Exceptions allowed for:

1. Arrow functions in callbacks
2. Array method callbacks
3. React component methods

```typescript
// Acceptable nested functions:
const numbers = [1, 2, 3].map((n) => n * 2);

useEffect(() => {
  const cleanup = () => {
    // Cleanup logic
  };
  return cleanup;
}, []);
```

### Function Documentation

Document functions using TSDoc comments to describe their purpose, parameters, return values, and any important notes:

```typescript
/**
 * Validates user data against business rules
 *
 * @remarks
 * This function performs comprehensive validation including:
 * - Email format
 * - Age restrictions
 * - Preference validation
 *
 * @param params - Validation parameters
 * @returns Validation result with any error messages
 * @throws {ValidationError} If the input is malformed
 * @see UserService for related functionality
 */
function validateUser(params: ValidateUserParams): ValidationResult {
  // Implementation
}
```

Common TSDoc tags for functions:

- `@param` - Documents function parameters
- `@returns` - Documents return value
- `@throws` - Documents exceptions that may be thrown
- `@remarks` - Adds additional details
- `@see` - References related code
- `@deprecated` - Marks as deprecated
- `@since` - Version when introduced
- `@example` - Provides usage examples

---

# 004-aibd-ts-errors.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/004-aibd-ts-errors.mdc

---
description: AIBD TypeScript Coding Guidelines - Error Handling
globs: 
alwaysApply: true
---

# AIBD TypeScript Coding Guidelines

## Error Handling

Use a union type of the actual result or a standard Error object for operations that can fail. This approach is cleaner and more type-safe than using a wrapper Result type:

```typescript
// Define a type alias for the result of an operation that can fail
type UserResult = User | Error;

/**
 * Schema for runtime validation of User data from API
 */
const UserResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

async function fetchUser(id: string): Promise<UserResult> {
  try {
    const response = await api.get(`/users/${id}`);
    
    // Use Zod to parse and validate the response data
    return UserResponseSchema.parse(response.data);
  } catch (error) {
    // Check if this is a Zod validation error
    if (error instanceof z.ZodError) {
      return new Error(
        `Invalid user data format: ${error.errors.map(e => `${e.path}: ${e.message}`).join(', ')}`
      );
    }
    
    // Handle other types of errors
    return new Error(`Failed to fetch user with ID ${id}`);
  }
}
```

### Error Class Descendants

Use Error subclasses in these scenarios:

1. When errors are central to your domain model
2. When you need strict typing for error properties
3. For complex error hierarchies
4. When errors are exposed in public APIs

```typescript
/**
 * Base error class for application errors
 * Use as foundation for more specific error types
 */
class AppError extends Error {
  public readonly timestamp: Date;
  
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    
    // Fix prototype chain for proper instanceof checks
    // Only needed in TypeScript/ES5 target
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validation-specific error with typed properties
 */
class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly constraint: string
  ) {
    super(message);
  }
  
  /**
   * Helper method to format error for API responses
   */
  toResponseFormat(): Record<string, unknown> {
    return {
      field: this.field,
      message: this.message,
      constraint: this.constraint
    };
  }
}

// Usage example
function validateUser(user: unknown): void {
  // Validate email format
  const email = (user as any)?.email;
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new ValidationError(
      'Invalid email format',
      'email',
      email,
      'email-format'
    );
  }
}
```

---

# 005-aibd-ts-zod.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/005-aibd-ts-zod.mdc

---
description: AIBD TypeScript Coding Guidelines - Schema Validation
globs: 
alwaysApply: true
---

# AIBD TypeScript Coding Guidelines

## Schema Validation

Use Zod for all schema validation. Follow this pattern:

1. Create a type definition file (e.g., `User.ts`):

```typescript
// User.ts
/**
 * Defines the structure of a User
 */
export type User = {
  /** Unique identifier */
  id: number;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** User's age */
  age?: number;
};
```

2. Create a schema file (e.g., `UserSchema.ts`):

```typescript
// UserSchema.ts
import { z } from "zod";
import type { User } from "./User";

/**
 * Schema for runtime validation of User type
 */
export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).optional(),
});

// Type compatibility checks, don't export them
const UserSchemaExhaustiveCheck: z.infer<typeof UserSchema> = {} as User;
const UserSchemaReverseCheck: User = {} as z.infer<typeof UserSchema>;

function validateUser(data: unknown): User {
  return UserSchema.parse(data);
}
```

Schema organization guidelines:

1. Define types explicitly, do not use `z.infer`
2. Add type compatibility checks:
   - Name compatibility checks with the format `{TypeName}SchemaExhaustiveCheck` and `{TypeName}SchemaReverseCheck`
   - Use both exhaustive and reverse type checks
3. Compose schemas for reusability

Example of schema composition:

```typescript
// AddressSchema.ts
import { z } from "zod";

export type Address = {
  street: string;
  city: string;
  zipCode: string;
};

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
});

export const AddressSchemaExhaustiveCheck: z.infer<typeof AddressSchema> =
  {} as Address;
export const AddressSchemaReverseCheck: Address = {} as z.infer<
  typeof AddressSchema
>;

// UserSchema.ts with composed schemas
import { AddressSchema, Address } from "./AddressSchema";

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  address: AddressSchema,
});
```

---

# 020-aibd-doc-prd.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/020-aibd-doc-prd.mdc

---
description: AIBD Documentation Guidelines - Feature level PRDs (Product Requirements Documents)
globs: 
alwaysApply: true
---

# AIBD Documentation Guidelines

## Feature level PRDs (Product Requirements Documents)

## Purpose
Every feature must include a `prd.md` file in its root directory. This document serves as the single source of truth for the feature's business and technical requirements, ensuring alignment between product, design, and engineering.

## Structure & Required Sections

A valid PRD must include the following sections, in this order:

1. **Title**
   - `# Product Requirements Document (PRD)`
2. **Feature Name**
   - `## Feature: <Feature Name>`
3. **Objective**
   - A concise statement describing the purpose and business value of the feature.
4. **User Stories**
   - A bulleted list of user stories, each starting with "As a <role>, I want <goal> so that <reason>."
5. **Requirements**
   - **Functional:** Numbered list of functional requirements, grouped by subtopic if needed (e.g., Form Fields, Validation, Submission, Security).
   - **Non-Functional:** Bulleted list of non-functional requirements (e.g., performance, responsiveness, styling, testing).
6. **Acceptance Criteria**
   - Checklist of criteria that must be met for the feature to be considered complete. Each should be testable and map to requirements/user stories.
7. **Out of Scope**
   - Bulleted list of items explicitly not included in this feature.

## Authoring & Review Guidelines
- Write in clear, unambiguous language.
- Use Markdown formatting for all sections and lists.
- All requirements must be specific, actionable, and testable.
- Acceptance criteria must be directly traceable to requirements and user stories.
- PRDs must be reviewed and approved before feature implementation begins.
- Any changes to the PRD after implementation starts must be tracked and justified.

## Example

```markdown
# Product Requirements Document (PRD)

## Feature: Admin Sign In Form

---

### Objective
Enable administrators to securely sign in to the admin dashboard using their email and password, leveraging Supabase authentication.

---

### User Stories
- **As an admin**, I want to sign in with my email and password so that I can access the admin dashboard.
- **As an admin**, I want to see clear error messages if I enter invalid credentials or leave fields empty.
- **As an admin**, I want to know when my sign-in request is being processed.

---

### Requirements

#### Functional
1. **Form Fields**
   - Email (type: email)
   - Password (type: password)
2. **Validation**
   - Both fields are required.
   - Show field-level error messages below each input if validation fails.
   - Do not use the native `required` attribute; handle validation in JavaScript.
3. **Submission**
   - On submit, disable all controls and show a loading spinner in the button.
   - Authenticate using Supabase's `signInWithPassword`.
   - If authentication fails, show the error message below the password field.
   - If authentication succeeds, redirect to `/admin/dashboard`.
4. **Accessibility**
   - All form controls must be accessible via keyboard.
   - Error messages must be screen-reader friendly.
5. **Security**
   - Do not expose sensitive error details.
   - Do not persist credentials in local storage or logs.

#### Non-Functional
- **Performance:** Form should respond instantly to user input and show loading state during authentication.
- **Responsiveness:** The form must be usable on both desktop and mobile devices.
- **Styling:** Use DaisyUI (with Tailwind) and match the app's current theme (light or dark as configured).
- **Testing:** Unit and integration tests must cover rendering, validation, error handling, and Supabase integration.

---

### Acceptance Criteria
- [x] Admin can enter email and password and submit the form.
- [x] Both fields are required; errors are shown below the relevant input.
- [x] On submit, controls are disabled and a loading spinner is shown.
- [x] On success, admin is redirected to `/admin/dashboard`.
- [x] On failure, a clear error is shown below the password field.
- [x] The form is accessible and responsive.
- [x] All requirements are covered by automated tests.

---

### Out of Scope
- Password reset functionality.
- Social login.
- Multi-factor authentication.
```

## Enforcement
- All new features must include a `prd.md` file following this structure.
- Code reviews must verify that the PRD is present, complete, and up-to-date for every feature.
- PRDs must be kept in sync with the implemented feature and updated as requirements evolve.

---

# 100-aibd-ts-react-shadcn.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/100-aibd-ts-react-shadcn.mdc

---
description: AIBD TypeScript Coding Guidelines - React Radix UI and Shadcn Guidelines
globs: 
alwaysApply: true
---

# AIBD TypeScript Coding Guidelines

## React Radix UI and Shadcn Guidelines

This rule defines how to use and extend shadcn UI components in AIBD React projects.

### Component Installation
- All shadcn UI components are already installed in the codebase and available for import from the `@/components/ui` directory.
- Do not re-install or duplicate shadcn components. Use the provided versions.

### Importing shadcn Components
- Always import shadcn UI components from the `@shared/shadcn-ui` directory using path aliases.
- Example:
  ```tsx
  import { Button } from "@shared/shadcn-ui/button";
  import { Input } from "@shared/shadcn-ui/input";
  ```
- Do not import directly from the `shadcn-ui` or `@radix-ui` packages in feature or app code.

### Usage Guidelines
- Use shadcn UI components as the primary building blocks for UI in features and shared components.
- Compose shadcn components with Tailwind CSS utility classes for custom styling.
- Do not modify the core shadcn component files directly. If you need to extend or override a component, create a wrapper or extension in your feature's `internal/` directory or in `shared/ui` if it is to be shared.
- All custom UI components should follow the same API and accessibility patterns as shadcn components.

### Accessibility
- All UI components (including custom extensions) must meet WCAG 2.1 AA accessibility standards.
- Use shadcn's built-in accessibility features and extend them as needed for your use case.

### Enforcement
- Code reviews must verify that only the pre-installed shadcn UI components are used and imported correctly.
- Any new shared UI components must be placed in `shared/ui` and follow shadcn conventions.
- Do not bypass or duplicate shadcn UI components in feature code.

---

# 101-aibd-blueprint-react-component.mdc

Source: https://raw.githubusercontent.com/gergelyszerovay/aibd-coding-guidelines/main/rules/101-aibd-blueprint-react-component.mdc

---
description: AIBD TypeScript Coding Guidelines - React Component and File Structure Blueprint
globs: 
alwaysApply: true
---

# AIBD TypeScript Coding Guidelines

## React Component and File Structure Blueprint

### Smart Components vs UI Components

- **Smart Components** (container, logic, or stateful components):
  - Responsible for state management, data fetching, business logic, and connecting to services.
  - Should not contain presentational markup except for layout wrappers.
  - May compose one or more UI components.
  - Must be placed at the feature root (e.g., `AdminSignIn.tsx`).
  - File name should match the component name.

- **UI Components** (presentational, dumb, or stateless components):
  - Responsible only for rendering UI based on props.
  - Must not contain business logic, state management, or side effects.
  - Must be placed in the feature's `internal/` directory (e.g., `internal/AdminSignInFormUi.tsx`).
  - File name must end with `Ui` (e.g., `AdminSignInFormUi.tsx`).

- **Enforcement:** Code reviews must verify that smart and UI components are separated and follow this structure.

**Example Directory:**
```
src/features/sign-in/
├── AdminSignIn.tsx                 # Smart component
└── internal/
    ├── AdminSignInFormUi.tsx       # UI component
    ├── handleSignInSubmit.ts       # Event handler
    ├── handleSignInChange.ts
    └── useSignInUi.ts              # Hook
```

---

### No Embedded Functions, Hooks, or Handlers

- All business logic, event handlers, and custom hooks must be defined in separate files, not inline within component files.
- **Handlers** (e.g., `handleSignInSubmit`, `handleSignInChange`) must be placed in the `internal/` directory within the feature.
- **Custom hooks** (e.g., `useSignInUi`) must be placed in the feature's `internal/` directory, and must end with `Ui` if they are for UI logic.
- **UI-only helpers** may be placed in the `internal/` directory if they are purely presentational.
- **Enforcement:** React component files should only contain the component definition and minimal prop destructuring. All logic and hooks must be imported.

**Example Directory:**
```
src/features/sign-in/
├── AdminSignIn.tsx
└── internal/
    ├── AdminSignInFormUi.tsx
    ├── handleSignInSubmit.ts
    ├── handleSignInChange.ts
    └── useSignInUi.ts
```

---

## File Structure and Naming

- Each file must export a single React component, hook, or handler.
- File name must match the exported symbol (e.g., `AdminSignIn.tsx` exports `AdminSignIn`).
- Use PascalCase for component and hook files, camelCase for handler files.
- UI components and UI hooks must end with `Ui` (e.g., `AdminSignInFormUi.tsx`, `useSignInUi.ts`).
- No default exports except for components.

---

## Testing

- All React component tests must use [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/).
- Tests should focus on user interactions and observable behavior, not implementation details.
- Prefer queries that reflect how users find elements (e.g., getByRole, getByLabelText, getByText).

