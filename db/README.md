# Module Records Management

A modern web application for managing Module records with full CRUD functionality, built with Next.js, TypeScript, and PostgreSQL.

## Features

- ✅ **Complete CRUD Operations** - Create, Read, Update, Delete Module records
- 🔍 **Advanced Search & Filtering** - Search by name, description, owner; filter by status and category
- 📊 **Responsive Data Tables** - Beautiful tables that work on desktop and mobile
- 📝 **Form Validation** - Comprehensive form validation with error handling
- 🎨 **Modern UI** - Clean, responsive design with dark mode support
- 📄 **Pagination** - Efficient pagination for large datasets
- 🏷️ **Status Management** - Track module status (Active, Inactive, Deprecated, Development)
- 📦 **Dependency Tracking** - Manage module dependencies
- 🌐 **REST API** - Full REST API for integration with other systems

## Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes for REST endpoints  
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS for responsive design
- **Validation**: Form validation with proper error handling

## Module Schema

Each module record includes:
- **ID** - Unique identifier (CUID)
- **Name** - Module name (required, unique)
- **Description** - Optional description
- **Number of Endplates** - Number of endplates (required, integer)
- **Number of Mainlines** - Single or Double mainlines (required, enum)
- **Status** - ACTIVE | INACTIVE | DEPRECATED | DEVELOPMENT
- **Category** - Module category (required)
- **Owner** - Module owner/maintainer
- **Location** - Physical or logical location (text field)
- **Documentation** - Documentation URL
- **Dependencies** - Array of dependency names
- **Created/Updated** - Automatic timestamps

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Git

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd modulerepo/db
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the database:**
   ```bash
   npx prisma dev
   ```

4. **Run database migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Seed the database with sample data:**
   ```bash
   npm run db:seed
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. **Open your browser:**
   Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:seed` - Seed database with sample data
- `npx prisma dev` - Start local PostgreSQL database
- `npx prisma migrate dev` - Run database migrations
- `npx prisma studio` - Open Prisma Studio database GUI

## API Endpoints

### Modules

- `GET /api/modules` - List modules with pagination and filtering
  - Query params: `page`, `limit`, `search`, `status`, `category`
- `POST /api/modules` - Create new module
- `GET /api/modules/[id]` - Get module by ID
- `PUT /api/modules/[id]` - Update module by ID
- `DELETE /api/modules/[id]` - Delete module by ID

### Example API Usage

```bash
# Get all modules
curl http://localhost:3000/api/modules

# Search modules
curl "http://localhost:3000/api/modules?search=react&status=ACTIVE"

# Create a module
curl -X POST http://localhost:3000/api/modules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Module",
    "numberOfEndplates": 4,
    "numberOfMainlines": "SINGLE",
    "category": "Frontend",
    "owner": "Development Team",
    "location": "City, State/Province, Country",
    "description": "A sample module"
  }'
```

## Environment Configuration

The application uses environment variables for configuration:

```bash
# Database
DATABASE_URL="prisma+postgres://localhost:51213/..."

# Next.js (optional)
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

## Database Management

### Prisma Commands

```bash
# Generate Prisma client
npx prisma generate

# Reset database
npx prisma migrate reset

# View database in GUI
npx prisma studio

# Format schema
npx prisma format
```

## Project Structure

```
src/
├── app/
│   ├── api/modules/          # API routes
│   ├── globals.css           # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page
├── components/
│   ├── ModuleForm.tsx       # Create/Edit form
│   ├── ModuleList.tsx       # Data table component
│   └── SearchAndFilter.tsx  # Search and filter UI
└── lib/
    └── prisma.ts            # Database client

prisma/
├── schema.prisma            # Database schema
├── seed.ts                  # Database seeder
└── migrations/              # Database migrations
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the GitHub repository.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
