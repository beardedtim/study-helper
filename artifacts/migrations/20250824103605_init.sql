-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;


CREATE TABLE notes(
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TRIGGER update_timestamp_trigger
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_timestamp();

CREATE TABLE note_references(
    note_id UUID NOT NULL,
    ref TEXT NOT NULL,
    FOREIGN KEY (note_id)
        REFERENCES notes(id)
        ON DELETE CASCADE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE note_references;
DROP TABLE notes;
-- +goose StatementEnd
