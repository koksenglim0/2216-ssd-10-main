const { AppError } = require('../utils/errors');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));
      return next(new AppError(422, 'Request validation failed', 'VALIDATION_ERROR', details));
    }

    req[source] = result.data;
    return next();
  };
}

module.exports = { validate };
