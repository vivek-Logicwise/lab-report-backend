# Burak Biomarker Backend

High-performance Node.js backend service for PDF biomarker extraction, analysis, and persistence.

## Features

- ✅ Multi-file PDF upload support
- ✅ Concurrent PDF processing with streaming
- ✅ 27 VIP marker + 280 secondary marker extraction
- ✅ Advanced health pattern detection
- ✅ Risk scoring and biological age calculation
- ✅ Transactional database operations with bulk inserts
- ✅ Production-ready error handling and logging
- ✅ Rate limiting and security headers

## Architecture

```
src/
├── config/          # Configuration and database setup
├── controllers/     # Request handlers
├── services/        # Business logic
├── repositories/    # Database access layer
├── middlewares/     # Express middlewares
├── utils/           # Helper functions
└── server.js        # Application entry point
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your database credentials

# Run server
npm start

# Development mode with auto-reload
npm run dev
```

## API Endpoints

### Upload and Process Biomarker PDFs

```
POST /api/biomarkers/upload
Content-Type: multipart/form-data

Body:
- files: PDF file(s) (max 10 files)
- participant_code: string (required)
- participant_name: string (optional)
- age: number (optional)
- gender: string (optional)
- ethnicity: string (optional)

Response: Structured JSON with analyzed biomarker data
```

## Environment Variables

See `.env.example` for all configuration options.

## Database Schema

Requires MSSQL database with tables:
- `participants`
- `vip_marker_references`
- `participant_biomarkers`
- `secondary_marker_references`
- `participant_secondary_markers`
- `analysis_results`

See `Document/Burak table script.txt` for complete schema.

## Performance Optimizations

1. **Connection Pooling**: Reuses database connections
2. **Concurrent Processing**: Processes multiple PDFs in parallel
3. **Streaming**: Memory-efficient file handling
4. **Bulk Inserts**: Batch database operations
5. **Transaction Management**: Ensures data integrity

## Error Handling

All errors are logged and returned in consistent format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional context"
}
```

## License

ISC
