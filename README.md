# TriTech Forge — Backend API

A professional Node.js/Express REST API for the TriTech Forge CRM platform.

## Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **Security**: Helmet, CORS, Rate Limiting

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (superadmin or company user) |
| GET | `/api/auth/verify` | Verify JWT token |
| POST | `/api/auth/change-password` | Change password |

### Companies (Superadmin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies` | List all companies |
| POST | `/api/companies` | Create new company |
| PUT | `/api/companies/:id` | Update company |
| DELETE | `/api/companies/:id` | Delete company |
| GET | `/api/companies/:id/credentials` | Get login credentials |
| POST | `/api/companies/:id/reset-password` | Reset company password |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies/:id/bookings` | List bookings (search, filter) |
| POST | `/api/companies/:id/bookings` | Create booking |
| PUT | `/api/companies/:id/bookings/:bId` | Update booking |
| DELETE | `/api/companies/:id/bookings/:bId` | Delete booking |
| GET | `/api/companies/:id/stats` | Company stats |
| GET | `/api/companies/:id/activity` | Activity log |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Global stats (superadmin) |

### Webhook (n8n / AI Agent)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/:companyId/booking` | Create booking via AI agent |

## Environment Variables

```env
PORT=3001
JWT_SECRET=your-super-secret-jwt-key
ADMIN_USERNAME=superadmin
ADMIN_PASSWORD=your-secure-password
FRONTEND_URL=https://your-frontend.railway.app
DB_PATH=./data/tritech.db
```

## Local Setup

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

## Webhook Usage (n8n)

Send a POST request to `/webhook/:companyId/booking` with header `x-api-key: <company_api_key>`:

```json
{
  "customerName": "John Smith",
  "phone": "(201) 555-0100",
  "issueType": "Leak",
  "date": "2025-05-15",
  "time": "10:00",
  "city": "Newark",
  "isEmergency": false
}
```
