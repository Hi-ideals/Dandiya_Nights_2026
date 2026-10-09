/**
 * Validates req[source] with a Zod schema and stores the parsed result on req.valid[source].
 * (Express 5 makes req.query read-only, so parsed values are kept separately.)
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  req.valid ??= {};
  req.valid[source] = schema.parse(req[source] ?? {});
  next();
};
