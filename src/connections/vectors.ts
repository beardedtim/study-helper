import { ChromaClient, EmbeddingFunction } from "chromadb";
import getenv from "getenv";
import ollama from "ollama";

export const client = new ChromaClient({
  host: getenv.string("VECTOR_HOST"),
  port: getenv.int("VECTOR_PORT"),
});

export class EmbeddingModel implements EmbeddingFunction {
  #model: string;
  constructor({ model }: { model: string }) {
    this.#model = model;
  }

  async generate(texts: string[]): Promise<number[][]> {
    return ollama
      .embed({
        model: this.#model,
        input: texts,
      })
      .then((res) => res.embeddings);
  }
}

export const mxBaiVectors = client.createCollection({
  name: "mxbai-large",
  embeddingFunction: new EmbeddingModel({
    model: "mxbai-embed-large",
  }),
});
