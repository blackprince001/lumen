// Copied from learning-app desktop @ bbf6eb8 (src/api/vault.rs, service and folder names changed); extract into desktop-kit after L2.
//! Keeps the cookie jar in the macOS Keychain, so a session survives
//! restarts the way it does in a browser. The `refresh_token` cookie is a
//! credential, so it doesn't go in a plain file.
//!
//! One Keychain item per server (`account` = host:port). Saved after any
//! response that changed the jar; deleted on sign-out.
//!
//! Keychain items are tied to the binary's signature, and every cargo build
//! changes it, so an unbundled dev build would hit a Keychain prompt after
//! each rebuild. Outside a `.app` bundle we use an owner-only file instead.

use std::{
    hash::{DefaultHasher, Hash, Hasher},
    sync::Mutex,
};

use reqwest_cookie_store::{CookieStore, CookieStoreMutex};
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};
use url::Url;

const SERVICE: &str = "work.pkab.lumen.desktop";

enum Store {
    Keychain,
    /// Dev builds: `~/Library/Application Support/lumen-desktop/dev-session-<account>.json`, mode 0600.
    File(std::path::PathBuf),
}

pub struct Vault {
    store: Store,
    account: String,
    /// Hash of what's in the Keychain, so unchanged jars aren't rewritten.
    saved: Mutex<u64>,
}

impl Vault {
    pub fn new(base: &Url) -> Self {
        let account = format!(
            "{}:{}",
            base.host_str().unwrap_or("localhost"),
            base.port_or_known_default().unwrap_or(0)
        );
        let bundled = std::env::current_exe()
            .map(|exe| exe.to_string_lossy().contains(".app/Contents/MacOS/"))
            .unwrap_or(false);
        // Release builds always use the Keychain; only debug builds fall back to a file.
        let store = if bundled || cfg!(not(debug_assertions)) {
            Store::Keychain
        } else {
            let home = std::env::var_os("HOME").unwrap_or_default();
            Store::File(
                std::path::PathBuf::from(home)
                    .join("Library/Application Support/lumen-desktop")
                    .join(format!("dev-session-{}.json", account.replace(':', "-"))),
            )
        };
        Self {
            store,
            account,
            saved: Mutex::new(0),
        }
    }

    fn read(&self) -> Option<Vec<u8>> {
        match &self.store {
            Store::Keychain => get_generic_password(SERVICE, &self.account).ok(),
            Store::File(path) => std::fs::read(path).ok(),
        }
    }

    fn write(&self, bytes: &[u8]) -> Result<(), String> {
        match &self.store {
            Store::Keychain => {
                set_generic_password(SERVICE, &self.account, bytes).map_err(|e| e.to_string())
            }
            Store::File(path) => {
                use std::{io::Write, os::unix::fs::OpenOptionsExt};
                if let Some(dir) = path.parent() {
                    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
                }
                std::fs::OpenOptions::new()
                    .write(true)
                    .create(true)
                    .truncate(true)
                    .mode(0o600)
                    .open(path)
                    .and_then(|mut f| f.write_all(bytes))
                    .map_err(|e| e.to_string())
            }
        }
    }

    /// The jar from the last run, or an empty one.
    pub fn load(&self) -> CookieStore {
        let Some(bytes) = self.read() else {
            return CookieStore::default();
        };
        // The line-per-cookie format the deprecated JSON calls use. Moving to
        // `cookie_store::serde::json` changes the format and would sign everyone out.
        #[allow(deprecated)]
        let loaded = CookieStore::load_json(bytes.as_slice());
        match loaded {
            Ok(store) => {
                *self.saved.lock().unwrap() = hash(&bytes);
                store
            }
            Err(err) => {
                log::warn!("ignoring unreadable saved session: {err}");
                CookieStore::default()
            }
        }
    }

    /// Write the jar if it changed. Blocking (Keychain call); run off the UI thread.
    pub fn save(&self, jar: &CookieStoreMutex) {
        let mut json = Vec::new();
        {
            let Ok(store) = jar.lock() else { return };
            #[allow(deprecated)]
            let saved = store.save_json(&mut json);
            if let Err(err) = saved {
                log::warn!("couldn't serialize cookies: {err}");
                return;
            }
        }
        let digest = hash(&json);
        let mut saved = self.saved.lock().unwrap();
        if *saved == digest {
            return;
        }
        match self.write(&json) {
            Ok(()) => *saved = digest,
            Err(err) => log::warn!("couldn't save the session: {err}"),
        }
    }

    pub fn forget(&self) {
        *self.saved.lock().unwrap() = 0;
        // A missing item is fine: nothing to forget.
        match &self.store {
            Store::Keychain => {
                let _ = delete_generic_password(SERVICE, &self.account);
            }
            Store::File(path) => {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

fn hash(bytes: &[u8]) -> u64 {
    let mut h = DefaultHasher::new();
    bytes.hash(&mut h);
    h.finish()
}
