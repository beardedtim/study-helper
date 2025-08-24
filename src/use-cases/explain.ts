import { z } from "zod";
import { SYSTEM_QUESTION_WRITER, userQuestionWriter } from "../prompts";
import { chat } from "../connections/llm";
import log from "../shared/log";

const ContextSchema = z.object({
  query: z
    .string()
    .describe(
      "What, in natural language, I am looking for an explaination for"
    ),
  why: z
    .string()
    .optional()
    .describe(
      "Why, in natural language, I am looking for the explaination. What do I need the computer's help with that this explaination would be useful for?"
    ),
});

export type ExplainCtx = z.infer<typeof ContextSchema>;

/**
 * `explain` uses LLMs + tool calling + custom logic in order
 * to help explain something to me specifically, based on my
 * notes and our past interactions
 */
async function explain(ctx: ExplainCtx) {
  log.info("Hello");
  const request = await ContextSchema.parseAsync(ctx);

  if (!request.why) {
    request.why =
      "I am just trying to understand more about this topic. I do not have a larger goal and the topic was simply interesting.";
  }

  /**
   * Step 1. Let's use an LLM to see if the query can be "better"
   * based off the `why` that we gave it
   */
  const messages = [
    {
      role: "system",
      content: SYSTEM_QUESTION_WRITER,
    },
    {
      role: "user",
      content: userQuestionWriter(request.query, request.why),
    },
  ];

  const result = await chat({
    messages,
    model: "phi4-mini",
  });

  return;
}

export default explain;
