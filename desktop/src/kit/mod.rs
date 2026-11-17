//! Generic pieces copied from Learning for Mac, laid out the way the future
//! `desktop-kit` crates will be: `net` (HTTP runtime, errors, cookie vault),
//! `state` (query cache, prefs, `Remote`) and `ui` (buttons, icons, motion,
//! type scale). Each file names where it came from. When Lumen's L2 lands,
//! these move into the shared crate and both apps depend on it.
//!
//! The SSE parser is not copied yet: nothing in L1 streams.

pub mod net;
pub mod state;
pub mod ui;
