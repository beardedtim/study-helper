import ollama from "ollama";

export const chat = ollama.chat.bind(ollama) as typeof ollama.chat;
