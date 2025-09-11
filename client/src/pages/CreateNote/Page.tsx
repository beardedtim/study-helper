import useNotesAPI from "@/hooks/useNotesAPI";
import React, { useState } from "react";
import { useLocation } from "wouter";

const CreateNotePage: React.FC = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const { createNote, error, loading } = useNotesAPI();
  const [_, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await createNote({ title, content });
    if (success) {
      setLocation("/notes");
    }
  };

  return (
    <div className="create-note-page">
      <h1>Create Note</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="note-title">Title</label>
          <input
            id="note-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="note-content">Content</label>
          <textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        {error && <div className="error">{error || "Error creating note"}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Note"}
        </button>
      </form>
    </div>
  );
};

export default CreateNotePage;
