
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");

  const loadTasks = () => {
    fetch("/api/tasks")
      .then(res => res.json())
      .then(setTasks);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const addTask = async () => {
    if (!title.trim()) return;

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });

    setTitle("");
    loadTasks();
  };

  const toggleTask = async (task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed })
    });
    loadTasks();
  };

  const deleteTask = async (id) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    loadTasks();
  };

  return (
    <main style={{ maxWidth: 600, margin: "60px auto", fontFamily: "Arial" }}>
      <h1>TaskFlow</h1>
      <p>Manage your daily tasks.</p>

      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Enter a task"
      />
      <button onClick={addTask}>Add task</button>

      {tasks.map(task => (
        <div key={task.id} style={{ marginTop: 15 }}>
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => toggleTask(task)}
          />
          <span style={{
            textDecoration: task.completed ? "line-through" : "none"
          }}>
            {task.title}
          </span>
          <button onClick={() => deleteTask(task.id)}>Delete</button>
        </div>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
