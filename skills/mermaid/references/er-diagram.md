---
name: mermaid-er-diagram
description: Comprehensive guide for generating Entity Relationship diagrams using Mermaid syntax.
---

# Mermaid Entity Relationship Diagrams


## Basic Syntax

### Simple ER Diagram
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
```

## Entities and Relationships

### Basic Syntax
```
<first-entity> [<relationship> <second-entity> : <relationship-label>]
```

Example:
```mermaid
erDiagram
    PROPERTY ||--|{ ROOM : contains
```

### Unicode and Markdown Support
```mermaid
erDiagram
    "This ❤ Unicode"
    "This **is** _Markdown_"
```

## Relationship Syntax

### Cardinality Markers

| Syntax | Meaning |
|--------|---------|
| `|o` `o|` | Zero or one |
| `||` `||` | Exactly one |
| `}o` `o{` | Zero or more |
| `}|` `|{` | One or more |

### Cardinality Aliases

| Alias | Symbol |
|-------|--------|
| `zero or one` `one or zero` | `|o` or `o|` |
| `only one` `1` | `||` |
| `zero or more` `zero or many` `many(0)` `0+` | `}o` or `o{` |
| `one or more` `one or many` `many(1)` `1+` | `}|` or `|{` |

### Identification

| Syntax | Type |
|--------|------|
| `--` | Identifying (solid line) |
| `..` | Non-identifying (dashed line) |

Aliases:
- `to` = identifying
- `optionally to` = non-identifying

Example:
```mermaid
erDiagram
    CAR ||--o{ NAMED-DRIVER : allows
    PERSON }o..o{ NAMED-DRIVER : is
```

Using aliases:
```mermaid
erDiagram
    CAR 1 to zero or more NAMED-DRIVER : allows
    PERSON many(0) optionally to 0+ NAMED-DRIVER : is
```

## Attributes

### Basic Attributes
```mermaid
erDiagram
    CAR ||--o{ NAMED-DRIVER : allows
    CAR {
        string registrationNumber
        string make
        string model
    }
    PERSON {
        string firstName
        string lastName
        int age
    }
```

### Attribute Keys

- `PK` - Primary Key
- `FK` - Foreign Key
- `UK` - Unique Key

Multiple keys: `PK, FK`

### Attribute Comments
```mermaid
erDiagram
    PERSON {
        string driversLicense PK "The license #"
        string(99) firstName "Only 99 characters"
        string lastName
        int age
    }
```

### Complete Example
```mermaid
erDiagram
    CAR ||--o{ NAMED-DRIVER : allows
    CAR {
        string registrationNumber PK
        string make
        string model
        string[] parts
    }
    PERSON ||--o{ NAMED-DRIVER : is
    PERSON {
        string driversLicense PK "The license #"
        string(99) firstName "Only 99 characters"
        string lastName
        string phone UK
        int age
    }
    NAMED-DRIVER {
        string carRegistrationNumber PK, FK
        string driverLicence PK, FK
    }
```

## Entity Name Aliases

```mermaid
erDiagram
    p[Person] {
        string firstName
        string lastName
    }
    a["Customer Account"] {
        string email
    }
    p ||--o| a : has
```

## Direction

```mermaid
erDiagram
    direction LR
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
```

Options: `TB`, `BT`, `LR`, `RL`

## Styling

### Individual Node Styling
```mermaid
erDiagram
    id1||--||id2 : label
    style id1 fill:#f9f,stroke:#333,stroke-width:4px
    style id2 fill:#bbf,stroke:#f66,stroke-width:2px
```

### Class Definitions
```mermaid
erDiagram
    direction TB
    CAR:::someclass {
        string registrationNumber
        string make
    }
    PERSON:::someclass {
        string firstName
        string lastName
    }
    
    classDef someclass fill:#f96
```

### Styling in Relationships
```mermaid
erDiagram
    PERSON:::foo ||--|| CAR : owns
    PERSON o{--|| HOUSE:::bar : has
    
    classDef foo stroke:#f00
    classDef bar stroke:#0f0
```

### Default Class
```mermaid
erDiagram
    PERSON:::foo ||--|| CAR : owns
    
    classDef default fill:#f9f,stroke-width:4px
    classDef foo stroke:#f00
```

## Configuration

### ELK Layout
```mermaid
---
config:
    layout: elk
---
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
```

## Best Practices

### Entity Naming
- Use singular nouns for entity names
- Capitalize entity names
- Use meaningful, descriptive names

### Relationships
- Always provide relationship labels
- Use appropriate cardinality markers
- Choose identifying vs non-identifying carefully

### Attributes
- Specify data types for clarity
- Mark primary and foreign keys
- Add comments for complex attributes
- Use appropriate attribute types

### Foreign Keys
- Include foreign keys when modeling physical database
- Use identifying relationships when entity depends on parent
- Document key constraints clearly

## Common Patterns

### One-to-Many
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        int customerId PK
        string name
        string email
    }
    ORDER {
        int orderId PK
        int customerId FK
        date orderDate
        decimal total
    }
```

### Many-to-Many with Junction Table
```mermaid
erDiagram
    STUDENT ||--o{ ENROLLMENT : enrolls
    COURSE ||--o{ ENROLLMENT : has
    STUDENT {
        int studentId PK
        string name
    }
    COURSE {
        int courseId PK
        string title
    }
    ENROLLMENT {
        int studentId PK, FK
        int courseId PK, FK
        date enrollmentDate
    }
```

### Inheritance (Supertype/Subtype)
```mermaid
erDiagram
    PERSON ||--o| EMPLOYEE : is
    PERSON ||--o| CUSTOMER : is
    PERSON {
        int personId PK
        string name
        string email
    }
    EMPLOYEE {
        int employeeId PK
        int personId FK
        string department
        decimal salary
    }
    CUSTOMER {
        int customerId PK
        int personId FK
        string loyaltyLevel
    }
```

### Self-Referencing Relationship
```mermaid
erDiagram
    EMPLOYEE ||--o{ EMPLOYEE : manages
    EMPLOYEE {
        int employeeId PK
        string name
        int managerId FK "References employeeId"
    }
```

### E-Commerce Database
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER-ITEM : contains
    PRODUCT ||--o{ ORDER-ITEM : includes
    CATEGORY ||--o{ PRODUCT : categorizes
    
    CUSTOMER {
        int customerId PK
        string name
        string email
        string address
    }
    ORDER {
        int orderId PK
        int customerId FK
        date orderDate
        decimal totalAmount
        string status
    }
    PRODUCT {
        int productId PK
        int categoryId FK
        string name
        decimal price
        int stock
    }
    ORDER-ITEM {
        int orderItemId PK
        int orderId FK
        int productId FK
        int quantity
        decimal unitPrice
    }
    CATEGORY {
        int categoryId PK
        string name
        string description
    }
```

### Blog System
```mermaid
erDiagram
    USER ||--o{ POST : writes
    POST ||--o{ COMMENT : has
    USER ||--o{ COMMENT : makes
    POST }o--o{ TAG : tagged
    
    USER {
        int userId PK
        string username UK
        string email UK
        string passwordHash
    }
    POST {
        int postId PK
        int authorId FK
        string title
        text content
        datetime publishedAt
    }
    COMMENT {
        int commentId PK
        int postId FK
        int userId FK
        text content
        datetime createdAt
    }
    TAG {
        int tagId PK
        string name UK
    }
    POST_TAG {
        int postId PK, FK
        int tagId PK, FK
    }
```
