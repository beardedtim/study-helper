import { Ollama } from "ollama";
import getenv from "getenv";
import Log from "../../shared/log";

import {
  SYSTEM_QUESTION_MERGER,
  SYSTEM_QUESTION_WRITER,
  userQuestionReWriter,
  userQuestionWriter,
} from "../../prompts";

import type { Query } from "./schemas";

const log = Log.child({
  name: "Domains::Query::Repo",
});

const MODELS = {
  QUESTION_REWRITE_SMALL: getenv.string(
    "QUESTION_REWRITE_SMALL_MODEL",
    "phi4-mini"
  ),
  QUESTION_REWRITE_BIG: getenv.string(
    "QUESTION_REWRITE_LARGE_MODEL",
    "qwen3:4b"
  ),
};

export interface GetBetterQuestionReq {
  llm: {
    chat: Ollama["chat"];
  };
  query: Query;
  emit: (data: Record<string, any>) => Promise<void>;
}

/**
 * Given a way to talk to an LLM and a Query, returns
 * a Query with possibly a better question
 */
export const getBetterQuestion = async ({
  llm,
  query,
  emit,
}: GetBetterQuestionReq) => {
  log.trace(query, "New request to get a better question");
  if (!query.why) {
    log.debug("No why given, setting default");

    query.why =
      "I am just trying to understand more about this topic. I do not have a larger goal and the topic was simply interesting.";
  }

  const rewriteCount = getenv.int("QUESTION_REWRITE_COUNT", 5);
  const messages = [
    {
      role: "system",
      content: SYSTEM_QUESTION_WRITER,
    },
    {
      role: "user",
      content: userQuestionWriter(query.query, query.why),
    },
  ];

  log.trace({ rewriteCount }, "Requesting rewrites from small model");

  await emit({
    status: "requesting-rewrites",
    count: rewriteCount,
  });

  const questionRewrites = await Promise.all(
    Array.from({ length: rewriteCount }, () =>
      llm.chat({
        messages,
        model: MODELS.QUESTION_REWRITE_SMALL,
        stream: false,
      })
    )
  );

  log.trace({ rewriteCount }, "Got responses. Asking big model to rewrite");
  const queries = questionRewrites.map((msg) => msg.message.content);

  await emit({
    status: "initial-rewrite-done",
    output: queries,
  });

  const result = await llm.chat({
    messages: [
      {
        role: "system",
        content: SYSTEM_QUESTION_MERGER,
      },
      {
        role: "user",
        content: userQuestionReWriter({
          question: query.query,
          why: query.why,
          rewrites: queries,
        }),
      },
    ],
    model: MODELS.QUESTION_REWRITE_BIG,
    stream: true,
  });

  return result;
};
