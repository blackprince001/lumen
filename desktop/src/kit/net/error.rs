// Copied from learning-app desktop @ bbf6eb8 (src/api/error.rs, adapted for FastAPI's `detail`); extract into desktop-kit after L2.
use serde::Deserialize;

/// Everything that can go wrong talking to the server.
#[derive(Debug, Clone, thiserror::Error)]
pub enum ApiError {
    /// The server answered with an error status. `message` is the server's
    /// own text when it sent one.
    #[error("{message}")]
    Http { status: u16, message: String },
    /// No answer: server down, connection dropped, timeout.
    #[error("Couldn't reach the server. Check your connection and try again.")]
    Network(String),
    /// The answer didn't match the shape we expected.
    #[error("The server sent something unexpected.")]
    Decode(String),
    /// We couldn't build the request.
    #[error("Couldn't prepare the request.")]
    Encode(String),
}

/// FastAPI sends `{"detail": "text"}`, or a list of validation problems.
#[derive(Deserialize)]
struct ErrorBody {
    detail: Option<serde_json::Value>,
    error: Option<String>,
    message: Option<String>,
}

impl ApiError {
    pub fn network(err: reqwest::Error) -> Self {
        ApiError::Network(err.to_string())
    }

    pub fn from_response(status: u16, body: &str) -> Self {
        let message = serde_json::from_str::<ErrorBody>(body)
            .ok()
            .and_then(|b| {
                let detail = match b.detail {
                    Some(serde_json::Value::String(s)) => Some(s),
                    Some(serde_json::Value::Array(items)) => items
                        .first()
                        .and_then(|i| i.get("msg"))
                        .and_then(|m| m.as_str())
                        .map(str::to_string),
                    _ => None,
                };
                detail.or(b.error).or(b.message)
            })
            .unwrap_or_else(|| format!("request failed ({status})"));
        ApiError::Http { status, message }
    }

    pub fn status(&self) -> Option<u16> {
        match self {
            ApiError::Http { status, .. } => Some(*status),
            _ => None,
        }
    }

    pub fn is_status(&self, status: u16) -> bool {
        self.status() == Some(status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_fastapi_detail() {
        let err = ApiError::from_response(401, r#"{"detail":"Invalid credentials"}"#);
        assert_eq!(err.to_string(), "Invalid credentials");
        assert!(err.is_status(401));
    }

    #[test]
    fn reads_first_validation_message() {
        let err = ApiError::from_response(422, r#"{"detail":[{"msg":"field required","loc":["body"]}]}"#);
        assert_eq!(err.to_string(), "field required");
    }

    #[test]
    fn falls_back_to_the_status() {
        assert_eq!(ApiError::from_response(502, "<html>").to_string(), "request failed (502)");
    }
}
