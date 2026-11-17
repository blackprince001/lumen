// Copied from learning-app desktop @ bbf6eb8 (src/state/prefs.rs, folder name changed); extract into desktop-kit after L2.
//! Small persisted preferences: the desktop stand-in for the web app's
//! localStorage (theme choice, window bounds).
//!
//! One JSON object in the app's support directory, written on every change.
//! A missing or unreadable file means defaults, never an error.

use std::{collections::BTreeMap, path::PathBuf};

use gpui::{App, Global};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::Value;

pub struct Prefs {
    path: Option<PathBuf>,
    values: BTreeMap<String, Value>,
}

impl Global for Prefs {}

impl Prefs {
    pub fn init(cx: &mut App) {
        let path = std::env::var_os("HOME").map(|home| {
            PathBuf::from(home)
                .join("Library/Application Support/lumen-desktop")
                .join("prefs.json")
        });
        let values = match path.as_ref().map(std::fs::read) {
            Some(Ok(bytes)) => serde_json::from_slice(&bytes).unwrap_or_else(|err| {
                log::warn!("ignoring unreadable preferences: {err}");
                BTreeMap::new()
            }),
            Some(Err(err)) if err.kind() != std::io::ErrorKind::NotFound => {
                log::warn!("couldn't read preferences: {err}");
                BTreeMap::new()
            }
            _ => BTreeMap::new(),
        };
        cx.set_global(Prefs { path, values });
    }

    pub fn get<T: DeserializeOwned>(cx: &App, key: &str) -> Option<T> {
        let value = cx.global::<Prefs>().values.get(key)?;
        serde_json::from_value(value.clone()).ok()
    }

    pub fn set<T: Serialize>(cx: &mut App, key: &str, value: &T) {
        let prefs = cx.global_mut::<Prefs>();
        match serde_json::to_value(value) {
            Ok(v) => {
                prefs.values.insert(key.to_string(), v);
            }
            Err(err) => {
                log::warn!("couldn't store preference {key}: {err}");
                return;
            }
        }
        prefs.save();
    }

    fn save(&self) {
        let Some(path) = &self.path else { return };
        let write = || -> std::io::Result<()> {
            if let Some(dir) = path.parent() {
                std::fs::create_dir_all(dir)?;
            }
            let json = serde_json::to_vec_pretty(&self.values).map_err(std::io::Error::other)?;
            // Write then rename, so a crash mid-write can't leave half a file.
            let tmp = path.with_extension("json.tmp");
            std::fs::write(&tmp, json)?;
            std::fs::rename(tmp, path)
        };
        if let Err(err) = write() {
            log::warn!("couldn't save preferences to {}: {err}", path.display());
        }
    }
}
