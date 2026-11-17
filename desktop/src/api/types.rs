//! The slices of the server's responses the desktop app reads. Field names
//! follow `backend/app/schemas`; anything we don't show is left out and
//! unknown fields are ignored.

use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct User {
    pub id: i64,
    pub email: String,
    pub display_name: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub role: String,
}

impl User {
    /// "Ada Lovelace" gives "Ada"; falls back to the email's local part.
    pub fn first_name(&self) -> String {
        self.display_name
            .split_whitespace()
            .next()
            .map(str::to_string)
            .unwrap_or_else(|| self.email.split('@').next().unwrap_or_default().to_string())
    }

    /// Up to two initials for the avatar.
    pub fn initials(&self) -> String {
        let name = if self.display_name.trim().is_empty() {
            self.email.split('@').next().unwrap_or_default()
        } else {
            self.display_name.as_str()
        };
        let mut letters: Vec<char> = name
            .split(|c: char| c.is_whitespace() || c == '.' || c == '_')
            .filter_map(|word| word.chars().next())
            .flat_map(|c| c.to_uppercase())
            .collect();
        letters.truncate(2);
        letters.into_iter().collect()
    }
}

/// `POST /auth/google` and `POST /auth/admin/login`.
#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_in: u64,
    pub user: User,
}

/// `POST /auth/refresh`.
#[derive(Debug, Clone, Deserialize)]
pub struct RefreshResponse {
    pub access_token: String,
    pub expires_in: u64,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Paper {
    pub id: i64,
    pub title: String,
    #[serde(default)]
    pub ai_summary: Option<String>,
    #[serde(default)]
    pub metadata_json: Option<serde_json::Value>,
    #[serde(default)]
    pub tags: Vec<Tag>,
    #[serde(default)]
    pub reading_status: Option<String>,
    #[serde(default)]
    pub processing_status: Option<String>,
}

impl Paper {
    /// Joined author names from `metadata_json` (`paperAuthors` on the web).
    pub fn authors(&self) -> Option<String> {
        let meta = self.metadata_json.as_ref()?;
        if let Some(list) = meta.get("authors_list").and_then(|v| v.as_array())
            && !list.is_empty()
        {
            let names: Vec<&str> = list.iter().filter_map(|n| n.as_str()).collect();
            if !names.is_empty() {
                return Some(names.join(", "));
            }
        }
        meta.get("author").and_then(|v| v.as_str()).map(str::to_string)
    }

    /// Four-digit publication year (`paperYear` on the web).
    pub fn year(&self) -> Option<String> {
        let meta = self.metadata_json.as_ref()?;
        if let Some(date) = meta.get("publication_date").and_then(|v| v.as_str()) {
            return Some(date.chars().take(4).collect());
        }
        match meta.get("year")? {
            serde_json::Value::String(s) => Some(s.clone()),
            serde_json::Value::Number(n) => Some(n.to_string()),
            _ => None,
        }
    }

    /// The first paragraph of the summary with Markdown marks removed, for a
    /// two-line preview.
    pub fn summary_preview(&self) -> Option<String> {
        let summary = self.ai_summary.as_deref()?;
        let first = summary.split("\n\n").next()?;
        let plain: String = first
            .lines()
            .map(|l| l.trim().trim_start_matches(['#', '-', '*', '>', ' ']))
            .collect::<Vec<_>>()
            .join(" ")
            .replace(['*', '`', '_'], "");
        let plain = plain.trim();
        (!plain.is_empty()).then(|| plain.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct PaperList {
    pub papers: Vec<Paper>,
    pub total: u64,
}

/// A folder. `/groups` returns every group the user can see, flat, each with
/// a `parent_id`; the sidebar builds the tree from that.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct Group {
    pub id: i64,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(name: &str, email: &str) -> User {
        User {
            id: 1,
            email: email.into(),
            display_name: name.into(),
            avatar_url: None,
            role: "user".into(),
        }
    }

    #[test]
    fn names_and_initials() {
        let ada = user("Ada Lovelace", "ada@example.com");
        assert_eq!(ada.first_name(), "Ada");
        assert_eq!(ada.initials(), "AL");
        let bare = user("", "grace.hopper@example.com");
        assert_eq!(bare.first_name(), "grace.hopper");
        assert_eq!(bare.initials(), "GH");
    }

    #[test]
    fn paper_metadata() {
        let paper: Paper = serde_json::from_str(
            r###"{"id":3,"title":"T","ai_summary":"## Idea\n\n**Bold** text","metadata_json":{"authors_list":["A","B"],"publication_date":"2023-05-29"}}"###,
        )
        .unwrap();
        assert_eq!(paper.authors().as_deref(), Some("A, B"));
        assert_eq!(paper.year().as_deref(), Some("2023"));
        assert_eq!(paper.summary_preview().as_deref(), Some("Idea"));
    }
}
