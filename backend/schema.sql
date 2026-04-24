-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    industry VARCHAR(100),
    website VARCHAR(255),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    role VARCHAR(100),
    department VARCHAR(100),
    hourly_rate DECIMAL(10, 2),
    availability VARCHAR(50) DEFAULT 'available',
    skills TEXT[],
    bio TEXT,
    avatar_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    base_price DECIMAL(10, 2),
    unit VARCHAR(50),
    estimated_hours INTEGER,
    deliverables TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing table
CREATE TABLE IF NOT EXISTS pricing (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pricing_type VARCHAR(50),
    base_amount DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    billing_frequency VARCHAR(50),
    discount_percentage DECIMAL(5, 2),
    minimum_commitment VARCHAR(100),
    features TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    category VARCHAR(100),
    description TEXT,
    content TEXT,
    variables TEXT[],
    is_default BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    priority VARCHAR(50) DEFAULT 'medium',
    start_date DATE,
    end_date DATE,
    budget DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2),
    project_manager_id INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
    team_members INTEGER[],
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    executive_summary TEXT,
    scope_of_work TEXT,
    deliverables TEXT,
    timeline TEXT,
    pricing_summary TEXT,
    terms_conditions TEXT,
    total_amount DECIMAL(12, 2),
    valid_until DATE,
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    accepted_at TIMESTAMP,
    rejected_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proposal Items table
CREATE TABLE IF NOT EXISTS proposal_items (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SOWs table
CREATE TABLE IF NOT EXISTS sows (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    introduction TEXT,
    objectives TEXT,
    scope TEXT,
    deliverables TEXT,
    timeline TEXT,
    milestones TEXT,
    assumptions TEXT,
    constraints TEXT,
    acceptance_criteria TEXT,
    payment_terms TEXT,
    change_management TEXT,
    governance TEXT,
    total_amount DECIMAL(12, 2),
    signed_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SOW Items table
CREATE TABLE IF NOT EXISTS sow_items (
    id SERIAL PRIMARY KEY,
    sow_id INTEGER REFERENCES sows(id) ON DELETE CASCADE,
    phase VARCHAR(255),
    task_name VARCHAR(255),
    description TEXT,
    assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
    estimated_hours INTEGER,
    start_date DATE,
    end_date DATE,
    dependencies TEXT[],
    deliverables TEXT[],
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    category VARCHAR(100),
    file_url VARCHAR(500),
    file_size INTEGER,
    mime_type VARCHAR(100),
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    sow_id INTEGER REFERENCES sows(id) ON DELETE SET NULL,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    tags TEXT[],
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Generations table
CREATE TABLE IF NOT EXISTS ai_generations (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    prompt TEXT,
    response TEXT,
    model VARCHAR(100),
    tokens_used INTEGER,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    sow_id INTEGER REFERENCES sows(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 2),
    metric_type VARCHAR(50),
    period VARCHAR(50),
    period_start DATE,
    period_end DATE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    type VARCHAR(50),
    category VARCHAR(100),
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing Suggestions table (AI-powered pricing recommendations)
CREATE TABLE IF NOT EXISTS pricing_suggestions (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    project_type VARCHAR(100),
    complexity VARCHAR(50),
    duration_weeks INTEGER,
    team_size INTEGER,
    suggested_min_price DECIMAL(12, 2),
    suggested_max_price DECIMAL(12, 2),
    suggested_hourly_rate DECIMAL(10, 2),
    pricing_strategy TEXT,
    rationale TEXT,
    market_comparison TEXT,
    confidence_score DECIMAL(5, 2),
    ai_response TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Win/Loss Analyses table (AI-powered proposal outcome analysis)
CREATE TABLE IF NOT EXISTS win_loss_analyses (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    proposal_title VARCHAR(255) NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    proposal_value DECIMAL(12, 2),
    competitor_name VARCHAR(255),
    key_factors TEXT[],
    strengths TEXT,
    weaknesses TEXT,
    lessons_learned TEXT,
    recommendations TEXT,
    client_feedback TEXT,
    ai_analysis TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Competitor Differentiators table (AI-powered competitive analysis)
CREATE TABLE IF NOT EXISTS competitor_differentiators (
    id SERIAL PRIMARY KEY,
    competitor_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    our_strengths TEXT,
    competitor_strengths TEXT,
    our_weaknesses TEXT,
    competitor_weaknesses TEXT,
    key_differentiators TEXT,
    positioning_strategy TEXT,
    talking_points TEXT,
    win_themes TEXT,
    ai_analysis TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Timeline Generations table (AI-powered project timeline creation)
CREATE TABLE IF NOT EXISTS timeline_generations (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_type VARCHAR(100),
    start_date DATE,
    end_date DATE,
    total_weeks INTEGER,
    phases JSONB,
    milestones JSONB,
    dependencies TEXT,
    resource_allocation TEXT,
    critical_path TEXT,
    buffer_time TEXT,
    ai_timeline TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Sections table (AI-powered risk assessment)
CREATE TABLE IF NOT EXISTS risk_sections (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    project_type VARCHAR(100),
    risk_category VARCHAR(100),
    identified_risks JSONB,
    risk_matrix TEXT,
    mitigation_strategies TEXT,
    contingency_plans TEXT,
    risk_owners TEXT,
    monitoring_approach TEXT,
    escalation_process TEXT,
    ai_assessment TEXT,
    status VARCHAR(50) DEFAULT 'active',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add password reset columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_sows_status ON sows(status);
CREATE INDEX IF NOT EXISTS idx_sows_client ON sows(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_ai_generations_type ON ai_generations(type);
CREATE INDEX IF NOT EXISTS idx_analytics_metric ON analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_pricing_suggestions_client ON pricing_suggestions(client_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_analyses_outcome ON win_loss_analyses(outcome);
CREATE INDEX IF NOT EXISTS idx_competitor_differentiators_competitor ON competitor_differentiators(competitor_name);
CREATE INDEX IF NOT EXISTS idx_timeline_generations_project ON timeline_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_risk_sections_project ON risk_sections(project_id);
