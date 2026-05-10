module.exports = {
  apps: [
    {
      name: "ccw-web",
      script: "pnpm",
      args: "start",
      // instances: "max",
      // exec_mode: "cluster",
      instances: 1,
      exec_mode: "fork",
    },
    {
      name: "ccw-worker",
      script: "pnpm",
      args: "exec tsx src/worker.ts",
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
