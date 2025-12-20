# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a Module Records Management System built with Next.js, TypeScript, and PostgreSQL. The application provides a modern web interface for creating, reading, updating, and deleting Module records.

## Tech Stack
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes for REST endpoints
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS for responsive design
- **Validation**: Form validation with proper error handling

## Code Standards
- Use TypeScript for all components and API routes
- Follow Next.js 15 App Router conventions
- Use Tailwind CSS for styling with mobile-first approach
- Implement proper error handling and loading states
- Use Prisma for database operations
- Follow RESTful API design patterns
- Ensure responsive design for all screen sizes

## Module Schema
Modules should include typical fields such as:
- ID (primary key)
- Name
- Description
- Version
- Status
- Created/Updated timestamps
- Category
- Dependencies
- Metadata fields

## Features to Implement
- CRUD operations for Module records
- Search and filtering capabilities
- Responsive data tables
- Form validation
- Error handling
- Loading states
- Pagination for large datasets
