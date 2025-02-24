export class CustomError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class APIKeyError extends CustomError { }
export class WebSocketError extends CustomError { }
