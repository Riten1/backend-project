class ApiResponse {
  constructor(data, statusCode, message="Success") {
    this.data = data;
    this.statusCode = statusCode;
    this.message = message;
    this.success = true;
  }
}

export default ApiResponse;