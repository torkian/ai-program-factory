# AI Program Factory

A comprehensive training program generation system powered by 9 specialized agents.

## Overview

The AI Program Factory automatically generates complete training programs for HR and Sales teams using a sophisticated 9-agent pipeline. Each program includes articles, video scripts, quizzes, exercises, and quality control scoring.

## Features

- **9-Agent Pipeline**: Specialized agents for brief normalization, structure creation, sourcing, content generation, quality control, and packaging
- **Real-time Progress**: Live updates during generation via server-sent events
- **Professional UI**: Modern responsive interface with form validation
- **Quality Control**: Automated scoring and fix suggestions for all content
- **Export Ready**: Structured manifest with organized content files

## Quick Start

1. **Setup Environment**
   ```bash
   cp .env.example .env
   # Add your OpenAI API key to .env
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Access Application**
   Open http://localhost:8080 in your browser

## Usage

1. Fill out the program requirements form
2. Click "Generate Training Program"
3. Watch real-time progress in the Processing tab
4. View complete results with QC scores

## Architecture

### The 9-Agent Pipeline

1. **Brief Normalizer** - Validates and structures requirements
2. **ARC & Matrix Agent** - Creates modular program architecture
3. **Sourcing Agent** - Builds reference material database
4. **Article Agent** - Generates comprehensive training articles
5. **Video Script Agent** - Creates engaging video content
6. **Quiz Agent** - Builds knowledge assessment quizzes
7. **Exercise Agent** - Designs practical exercises
8. **QC Agent** - Automated quality control and scoring
9. **Packager** - Creates final manifest and export structure

### Tech Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Frontend**: Vanilla HTML/CSS/JS with modern styling
- **Integration**: OpenAI API (GPT-4o-mini)
- **Storage**: In-memory with structured data models
- **Real-time**: Server-sent events for live updates

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=8080
MODEL=gpt-4o-mini
```

### Program Types

- **HR Training**: Employee development, compliance, policies
- **Sales Training**: Methodology, objection handling, process optimization

## Development

```bash
# Development with hot reload
npm run dev

# Production build
npm start

# Type checking
npm run type-check
```

## API Endpoints

- `POST /api/programs` - Generate new training program
- `GET /api/programs/:id` - Retrieve program details
- `GET /api/programs/progress/:jobId` - Real-time progress stream

## Deployment

### Deploy to Render.com

This application is optimized for Render.com deployment with the included `render.yaml` configuration.

#### One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/torkian/ai-program-factory)

#### Manual Deployment

1. **Fork or clone** this repository to your GitHub account
2. **Create a new Web Service** on [Render.com](https://render.com)
3. **Connect your repository** to the new service
4. **Set environment variables** in the Render dashboard:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=production
   PORT=10000
   MODEL=gpt-4o-mini
   ```
5. **Deploy** - Render will automatically build and deploy your application

#### Environment Variables

The following environment variables need to be set in Render:

- `OPENAI_API_KEY` ⚠️ **Required** - Your OpenAI API key
- `NODE_ENV` - Set to `production` for production deployments
- `PORT` - Render automatically sets this to 10000
- `MODEL` - OpenAI model to use (default: `gpt-4o-mini`)

#### Build Configuration

The application uses the following build process:
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Health Check**: Available at `/` endpoint

## Local Development

For local development, copy `.env.example` to `.env` and add your OpenAI API key:

```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
npm install
npm run dev
```

## License

MIT