import Log from "../shared/log";
import DB from "../connections/db";
import * as LLM from "../connections/llm";
import * as QueryDomain from "../domains/query";
import { SSEStreamingApi } from "hono/streaming";
import { genGoodEnoughID } from "../shared/utils";

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

      minChunkLength = minChunkLength * 2;
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
