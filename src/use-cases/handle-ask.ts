import Log from "../shared/log";
import DB from "../connections/db";
import * as LLM from "../connections/llm";
import * as QueryDomain from "../domains/query";
import { SSEStreamingApi } from "hono/streaming";
import { genGoodEnoughID } from "../shared/utils";
import { SYSTEM_THEOLOGICAL_MENTOR } from "../prompts";
import getenv from "getenv";

const log = Log.child({
  name: "use-case::handle-ask",
});

const handleAsk = async ({
  query,
  why,
  stream,
}: {
  query: string;
  why?: string;
  stream: SSEStreamingApi;
}) => {
  const instanceId = genGoodEnoughID({
    prefix: "ask",
    length: 15,
  });

  log.trace({ query, why, instanceId }, "New Ask received");

  await stream.writeSSE({
    id: genGoodEnoughID({ prefix: "ask", length: 15 }),
    data: JSON.stringify({
      meta: {
        id: instanceId,
      },
    }),
    event: "ask-started",
  });

  log.info({ instanceId }, "Requesting better question");

  const betterQuestionId = genGoodEnoughID({
    prefix: "action",
    length: 15,
  });

  await stream.writeSSE({
    id: genGoodEnoughID({ prefix: "action", length: 15 }),
    data: JSON.stringify({
      name: "gen-better-question",
      id: betterQuestionId,
      meta: {
        instanceId,
      },
    }),
    event: "action-start",
  });

  const bestQuestion = await QueryDomain.Repo.getBetterQuestion({
    llm: LLM,
    query: {
      query,
      why,
    },
    emit: async (data) => {
      await stream.writeSSE({
        id: genGoodEnoughID({
          prefix: `action-output`,
          length: 15,
        }),
        data: JSON.stringify({
          id: betterQuestionId,
          output: data,
          meta: {
            instanceId,
          },
        }),
        event: "action-output",
      });
    },
  });

  log.info(bestQuestion, "Got a much better question, hopefully");

  let questionText = "";
  let minChunkLength = 126;

  for await (const chunk of bestQuestion) {
    const nextTextChunk = chunk.message.content;

    questionText += nextTextChunk ?? "";

    if (minChunkLength <= questionText.length) {
      await stream.writeSSE({
        id: genGoodEnoughID({ prefix: "action-output-", length: 15 }),
        data: JSON.stringify({
          id: betterQuestionId,
          chunk: questionText,
          meta: {
            instanceId,
          },
        }),
        event: "action-output",
      });

      minChunkLength += 126;
    }
  }

  await stream.writeSSE({
    id: genGoodEnoughID({ prefix: "action", length: 15 }),
    data: JSON.stringify({
      id: betterQuestionId,
      output: questionText,
      meta: {
        instanceId,
      },
    }),
    event: "action-end",
  });

  log.info(
    "Now I am going to use to final question text to ask a smarter LLM about it"
  );

  const answerId = genGoodEnoughID({
    prefix: "answer-",
    length: 15,
  });

  await stream.writeSSE({
    id: genGoodEnoughID({ prefix: "answer-", length: 15 }),
    data: JSON.stringify({
      id: answerId,
      meta: {
        instanceId,
      },
    }),
    event: "answer-start",
  });

  const answerStream = await LLM.chat({
    messages: [
      {
        role: "system",
        content: SYSTEM_THEOLOGICAL_MENTOR,
      },
      {
        role: "user",
        content: questionText,
      },
    ],
    model: getenv.string("QUESTION_ANSWER_MODEL", "phi4-mini-reasoning"),
    stream: true,
  });

  for await (const chunk of answerStream) {
    const nextTextChunk = chunk.message.content;

    await stream.writeSSE({
      id: genGoodEnoughID({ prefix: "answer-output-", length: 15 }),
      data: JSON.stringify({
        id: answerId,
        chunk: nextTextChunk,
        meta: {
          instanceId,
        },
      }),
      event: "answer-output",
    });
  }

  await stream.writeSSE({
    id: genGoodEnoughID({ prefix: "answer-", length: 15 }),
    data: JSON.stringify({
      id: answerId,
      meta: {
        instanceId,
      },
    }),
    event: "answer-stop",
  });

  await stream.writeSSE({
    id: `ask-${crypto.randomUUID()}`,
    data: JSON.stringify({
      meta: {
        id: instanceId,
      },
    }),
    event: "ask-ended",
  });
};

export default handleAsk;
