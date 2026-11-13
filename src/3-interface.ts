interface Task {
  id: number;
  title: string;
  done: boolean;
  deadline?: string; // optional field
}

const tasks: Task[] = [
  { id: 1, title: "Сделать ДЗ по Git", done: true },
  { id: 2, title: "Повторить типы", done: false, deadline: "11.11" },
  { id: 3, title: "Сдать ДЗ 4", done: false },
  { id: 4, title: "Сдать ДЗ 5", done: false },
  { id: 5, title: "Подать заявку на DevShow", done: false },
];

function addTask(list: Task[], title: string): Task {
  const task: Task = { id: list.length + 1, title, done: false };
  list.push(task);
  return task;
}

function completeTask(list: Task[], id: number): void {
  const task = list.find((t) => t.id === id);
  if (task) {
    task.done = true;
  }
}

function pending(list: Task[]): Task[] {
  return list.filter((t) => !t.done);
}

addTask(tasks, "Посмотреть запись урока");
completeTask(tasks, 2);
console.log(pending(tasks)); // tasks 3, 4, 5 and "Посмотреть запись урока" are left
