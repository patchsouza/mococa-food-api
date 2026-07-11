export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const BadRequest = (msg, details) => new HttpError(400, msg, details);
export const Unauthorized = (msg = 'Não autenticado') => new HttpError(401, msg);
export const Forbidden = (msg = 'Sem permissão para esta ação') => new HttpError(403, msg);
export const NotFound = (msg = 'Recurso não encontrado') => new HttpError(404, msg);
export const Conflict = (msg = 'Conflito de estado') => new HttpError(409, msg);
