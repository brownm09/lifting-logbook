import { app } from './server';

const PORT = process.env['PORT'] ?? 3001;

app.listen(PORT, () => {
  console.log(`api-legacy listening on port ${PORT}`);
});
