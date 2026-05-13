Starting: *Generate Backend Handoff List* (2/2)

Here is a comprehensive "Backend Handoff List" for your friend. Since the frontend is currently running entirely on mock objects and local state, these are the API routes, server actions, and cron jobs they'll need to build to wire everything up:

### 1. Database & Schema Updates
### New: `Problem` collection (`src/models/Problem.ts`)
Caches Codeforces problem metadata.

```ts
{
  cfContestId: Number,        // e.g. 1700
  cfIndex:     String,        // e.g. "A", "B1"
  name:        String,
  rating:      Number,        // e.g. 1500
  tags:        [String],
  createdAt:   Date,
  updatedAt:   Date,
}
// Unique index: { cfContestId, cfIndex }
```

### New: `DailyChallenge` collection (`src/models/DailyChallenge.ts`)
One document per POTD day.

```ts
{
  // Main window:  5:00 PM IST (11:30 UTC) → 4:59 PM IST next day (11:29 UTC)
  // Grace window: 4:59 PM IST → 5:59 PM IST next day (11:29 UTC → 12:29 UTC)
  windowStart:  Date,         // UTC: 11:30 UTC on the challenge date
  windowEnd:    Date,         // UTC: 11:29 UTC the next calendar day (main window close)
  graceEnd:     Date,         // UTC: 12:29 UTC the next calendar day (grace window close)
  problem:      ObjectId,     // ref: Problem
  setBy:        ObjectId,     // ref: User (admin who scheduled it)
  createdAt:    Date,
  updatedAt:    Date,
}
// Unique index: { windowStart }
```

### New: `PotdSubmission` collection (`src/models/PotdSubmission.ts`)
One document per (user, challenge) pair.

```ts
{
  userId:         ObjectId,   // ref: User
  challengeId:    ObjectId,   // ref: DailyChallenge
  // Status lifecycle:
  //   Pending   → not yet verified by manual sync or cron
  //   Accepted  → solved within main window OR grace window (points > 0, streak increments)
  //   Late      → solved after graceEnd (0 points, streak unaffected)
  //   NotSolved → cron confirmed no solve after grace + health-check cycle
  status:         String,
  solvedInGrace:  Boolean,    // true if solvedAt is between windowEnd and graceEnd
  pointsAwarded:  Number,     // 0 if Late or NotSolved
  solvedAt:       Date,       // UTC when CF API confirmed the solve (null if unsolved)
  lastCheckedAt:  Date,       // UTC of last manual or cron check
  createdAt:      Date,
  updatedAt:      Date,
}
// Unique index: { userId, challengeId }
// Compound index: { challengeId, status }         — for cron sync queries (Pending users)
// Compound index: { challengeId, pointsAwarded }  — for leaderboard aggregation
// Compound index: { userId, solvedAt }            — for user profile solve history
```

### New: `PointTransaction` collection (`src/models/PointTransaction.ts`)
Logs individual point-earning events with timestamps for timeframe-based leaderboards.

```ts
{
  userId:       ObjectId,   // ref: User
  potdId:       ObjectId,   // ref: DailyChallenge
  pointsEarned: Number,
  createdAt:    Date,
}
// Compound index: { userId, createdAt } — for timeframe leaderboard aggregation
```

### 2. Admin Problem Management Routes (CRUD)
*Controller/Security: All these routes MUST verify the user is logged in and `isAdmin(user.role)` is true.*
*   **`GET /api/potd/planned`**: Fetch schedule. Returns POTD documents where the date is between `today` and `today + 7 days`.
*   **`POST /api/potd`**: Create a new POTD assignment for a specific date in the DB.
*   **`PUT /api/potd/:id`**: Update an existing POTD (e.g., swapping out the `problemId` or moving the `date`).
*   **`DELETE /api/potd/:id`**: Remove a planned POTD from the DB.

### 3. Core POTD Operations (User-Facing Routes)
*   **`GET /api/potd/today`**: 
    *   *Logic*: Fetch the single POTD document matching the current system date.
    *   *Additions*: Return a boolean `hasSolved` determining if the currently logged-in user has already synced their answer for today.

### 4. Leaderboard & History Routes
*   **`GET /api/potd/history`**:
    *   *Logic*: Return all past POTD documents (`date < today`), sorted backwards by date.
*   **`GET /api/leaderboard/points?timeframe=<week|month|all>`**:
    *   *Logic*: Aggregate `PointTransaction` documents grouped by `userId` within the given timestamp window. Populate the user's `name` and CF `handle` and return sorted descending arrays.
*   **`GET /api/leaderboard/streaks`**:
    *   *Logic*: Simple query directly against the `User` accounts. Return top 50 users sorted descending by `potdCurrentStreak` or `potdMaxStreak`.

### 5. Utilities & Helpers
*   **Codeforces API Wrapper (`src/lib/cf-api.ts`)**:
    *   Create a simple helper function `fetchProblemMetadata(problemId: string)` that hits `https://codeforces.com/api/contest.standings?contestId=${contestId}` (just like we did on the frontend) to automatically populate the `Problem` collection during admin entry creation securely on the server.
    *   *Note*: Ensure error handling for rate limits or CF downtime.