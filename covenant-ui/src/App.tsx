import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { CreateTaskCard } from './components/CreateTaskCard';
import { TaskFeed } from './components/TaskFeed';

function App() {
  return (
    <div className="min-h-screen bg-background text-slate-200 selection:bg-primary/30">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-12">
        <Hero />

        <div className="space-y-12">
          <section>
            <CreateTaskCard />
          </section>

          <section>
            <TaskFeed />
          </section>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-slate-600 font-mono">
        COVENANT PROTOCOL v1.0.0 • UNVERIFIED SOFTWARE
      </footer>
    </div>
  );
}

export default App;
