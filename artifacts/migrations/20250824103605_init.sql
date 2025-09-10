-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

-- Ensures we have the vector extension on for every
-- future table that needs it
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS sources (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    source TEXT NOT NULL, -- uri or path to the source
    metadata JSONB, -- any additional metadata about the source
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);


-- Chunks of 1024 sizing with associated text and metadata
CREATE TABLE IF NOT EXISTS chunks_1024(
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    embeddings vector(1024) NOT NULL,
    chunk TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model TEXT NOT NULL, -- the model that was used for embedding
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    PRIMARY KEY (id)
);

CREATE TRIGGER update_timestamp_trigger
    BEFORE UPDATE ON chunks_1024
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_timestamp();

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS chunks_1024;
DROP TABLE IF EXISTS sources;
-- +goose StatementEnd
