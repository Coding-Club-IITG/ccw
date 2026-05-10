# Coding Club IITG Website

The official web platform for Coding Club IITG.

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Authentication:** [Auth.js v5](https://authjs.dev/) (Microsoft Entra ID)
- **Database:** [MongoDB](https://www.mongodb.com/) with [Mongoose](https://mongoosejs.com/)
- **Caching:** [Redis](https://redis.io/)
- **Styling:** SCSS Modules
- **State Management:** Zustand

## Prerequisites

- **Node.js:** v24.15.0+
- **Package Manager:** [pnpm](https://pnpm.io/)
- **MongoDB:** A running instance or MongoDB Atlas URI
- **Redis:** A running instance (local or cloud)

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in all the variables

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```
2. **Run in development mode:**
   ```bash
   pnpm dev
   ```
3. **Build for production:**
   ```bash
   pnpm build
   ```

## Administrative Setup

To grant access to yourself or a new member, you can use the built-in initialization script:

1. Ensure your `.env.local` has a valid `MONGODB_URI`.
2. Run the script:
   ```bash
   pnpm init-admin
   ```

## Contributing

Please follow the club's coding standards. Ensure all new features are type-safe and accompanied by appropriate documentation.
