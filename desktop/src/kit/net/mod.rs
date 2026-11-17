// Copied from learning-app desktop @ bbf6eb8 (src/api/mod.rs, runtime part); extract into desktop-kit after L2.
//! The HTTP runtime. Requests run on a Tokio runtime that lives on its own
//! threads; GPUI code awaits the futures `spawn` returns.

mod error;
pub mod vault;

use std::{future::Future, sync::OnceLock};

pub use error::ApiError;

fn runtime() -> &'static tokio::runtime::Runtime {
    static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .thread_name("api")
            .enable_all()
            .build()
            .expect("failed to start the HTTP runtime")
    })
}

/// Runs `future` on the HTTP runtime and resolves with its output. Safe to
/// await from GPUI's executors, which know nothing about Tokio.
pub fn spawn<F>(future: F) -> impl Future<Output = F::Output> + 'static
where
    F: Future + Send + 'static,
    F::Output: Send + 'static,
{
    let handle = runtime().spawn(future);
    async move {
        match handle.await {
            Ok(output) => output,
            // Tasks are never aborted, so this is a panic inside the task.
            Err(err) => std::panic::resume_unwind(err.into_panic()),
        }
    }
}

/// Like `spawn`, but dropping the returned future aborts the task, so a
/// cancelled flow stops waiting and frees its socket.
pub fn spawn_cancellable<F>(future: F) -> impl Future<Output = F::Output> + 'static
where
    F: Future + Send + 'static,
    F::Output: Send + 'static,
{
    Cancellable(runtime().spawn(future))
}

struct Cancellable<T>(tokio::task::JoinHandle<T>);

impl<T> Future for Cancellable<T> {
    type Output = T;

    fn poll(mut self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context<'_>) -> std::task::Poll<T> {
        match std::pin::Pin::new(&mut self.0).poll(cx) {
            std::task::Poll::Ready(Ok(output)) => std::task::Poll::Ready(output),
            std::task::Poll::Ready(Err(err)) => std::panic::resume_unwind(err.into_panic()),
            std::task::Poll::Pending => std::task::Poll::Pending,
        }
    }
}

impl<T> Drop for Cancellable<T> {
    fn drop(&mut self) {
        self.0.abort();
    }
}
