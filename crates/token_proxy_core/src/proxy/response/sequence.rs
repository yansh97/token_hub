use serde_json::{Number, Value};

/// Tracks the next valid Responses event sequence without rewriting healthy events.
#[derive(Default)]
pub(crate) struct ResponsesEventSequence {
    next: u64,
}

impl ResponsesEventSequence {
    pub(crate) fn observe_data(&mut self, data: &str) {
        if let Ok(value) = serde_json::from_str::<Value>(data) {
            self.observe_value(&value);
        }
    }

    pub(crate) fn observe_value(&mut self, value: &Value) {
        if let Some(sequence_number) = value.get("sequence_number").and_then(Value::as_u64) {
            self.next = self.next.max(sequence_number + 1);
        }
    }

    pub(crate) fn take_next(&mut self) -> u64 {
        let sequence_number = self.next;
        self.next += 1;
        sequence_number
    }

    pub(crate) fn ensure_error_event(&mut self, value: &mut Value) -> Option<u64> {
        if !is_error_event(value) {
            self.observe_value(value);
            return None;
        }
        if value
            .get("sequence_number")
            .and_then(Value::as_u64)
            .is_some()
        {
            self.observe_value(value);
            return None;
        }
        let sequence_number = self.take_next();
        value["sequence_number"] = Value::Number(Number::from(sequence_number));
        Some(sequence_number)
    }
}

fn is_error_event(value: &Value) -> bool {
    matches!(
        value.get("type").and_then(Value::as_str),
        Some("response.failed" | "response.error" | "error")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn assigns_only_missing_error_sequence_after_highest_observed_value() {
        let mut sequence = ResponsesEventSequence::default();
        sequence.observe_value(&json!({
            "type": "response.output_text.delta",
            "sequence_number": 7
        }));
        let mut missing = json!({"type": "response.failed"});

        assert_eq!(sequence.ensure_error_event(&mut missing), Some(8));
        assert_eq!(missing["sequence_number"], json!(8));

        let mut existing = json!({"type": "error", "sequence_number": 12});
        assert_eq!(sequence.ensure_error_event(&mut existing), None);
        assert_eq!(sequence.take_next(), 13);
    }

    #[test]
    fn leaves_normal_event_without_sequence_unchanged() {
        let mut sequence = ResponsesEventSequence::default();
        let mut event = json!({"type": "response.output_text.delta", "delta": "hello"});

        assert_eq!(sequence.ensure_error_event(&mut event), None);
        assert!(event.get("sequence_number").is_none());
    }
}
