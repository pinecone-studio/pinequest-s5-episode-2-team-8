// One thread runs all the game: every socket message, timer and storage step is queued here and run in turn, and the code after
// an `await` comes back to this thread. So the game state is never touched by two threads at once, as in the JS server.
using System.Collections.Concurrent;

namespace Naadamy.Server;

public sealed class Loop : SynchronizationContext
{
    public static readonly Loop I = new();
    readonly BlockingCollection<(SendOrPostCallback cb, object? state)> queue = new();
    readonly Thread thread;

    Loop()
    {
        thread = new Thread(Run) { IsBackground = true, Name = "naadamy-loop" };
        thread.Start();
    }
    void Run()
    {
        SetSynchronizationContext(this);
        foreach (var (cb, state) in queue.GetConsumingEnumerable())
        {
            try { cb(state); }
            catch (Exception e) { Console.Error.WriteLine("Unhandled error in the game loop: " + e); }
        }
    }
    public override void Post(SendOrPostCallback d, object? state) => queue.Add((d, state));
    public override void Send(SendOrPostCallback d, object? state)
    {
        if (Thread.CurrentThread == thread) { d(state); return; }
        using var done = new ManualResetEventSlim();
        Exception? error = null;
        Post(_ => { try { d(state); } catch (Exception e) { error = e; } finally { done.Set(); } }, null);
        done.Wait();
        if (error != null) throw error;
    }
    public override SynchronizationContext CreateCopy() => this;

    /** Runs fire-and-forget work on the loop; its errors are logged. */
    public static void Go(Func<Task> work) => I.Post(async _ =>
    {
        try { await work(); } catch (Exception e) { Console.Error.WriteLine("Unhandled error in the game loop: " + e.Message); }
    }, null);
    /** Runs work on the loop and gives its result to a caller on another thread (an HTTP request). */
    public static Task<T> Run<T>(Func<Task<T>> work)
    {
        var tcs = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        I.Post(async _ => { try { tcs.SetResult(await work()); } catch (Exception e) { tcs.SetException(e); } }, null);
        return tcs.Task;
    }
    /** setTimeout: runs `action` on the loop after `ms`. Dispose the result to cancel it. */
    public static IDisposable After(long ms, Action action)
    {
        var timer = new Timer(_ => I.Post(_ => action(), null), null, Math.Max(0, ms), Timeout.Infinite);
        return timer;
    }
    /** setInterval on the loop. */
    public static IDisposable Every(long ms, Action action) => new Timer(_ => I.Post(_ => action(), null), null, ms, ms);
}
