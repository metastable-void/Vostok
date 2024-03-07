
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import multer from 'multer';

import 'dotenv/config';
import express from 'express';

const PORT = parseInt(process.env.PORT || '3000', 10);
const JSON_DATA_PATH = process.env.JSON_DATA_PATH || 'data.json';
const FILES_DIR_PATH = process.env.FILES_DIR_PATH || 'files';

const PASSWORD_ALGORITHM = 'sha256';

// MIME type -> file extension
const MIME_WHITELIST: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/webm': '.webm',
  'video/mp2t': '.ts',
  'video/ogg': '.ogv',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/flac': '.flac',
  'audio/x-matroska': '.mka',
};

type File = {
  title: string;
  filename: string;
};

type User = {
  screen_name: string;
  password_algorithm: string;
  hashed_password: string;
  data_dir_name: string;
};

type Data = {
  users: Record<string, User>; // screen_name -> User
  files: Record<string, File[]>; // data_dir_name -> File[]
};

const getData = async (): Promise<Data> => {
  try {
    const data = await fs.readFile(JSON_DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return { users: {}, files: {} };
  }
};

const saveData = async (data: Data): Promise<void> => {
  await fs.writeFile(JSON_DATA_PATH, JSON.stringify(data, null, 2));
};

const generateDataDirName = (): string => {
  return crypto.randomBytes(8).toString('hex');
};

const app = express();

const upload = multer({
  storage: multer.diskStorage({}),
  fileFilter: (req, file, cb) => {
    if (Object.keys(MIME_WHITELIST).includes(String(file.mimetype).toLowerCase())) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid file type'));
  },
  limits: {
    fileSize: 1024 * 1024 * 100, // 100MB
    files: 1,
  },
});

app.set('trust proxy', true);

app.get('/api/users', async (req, res) => {
  const data = await getData();
  res.json({
    users: Object.keys(data.users),
  });
});

app.get('/api/users/:screen_name', async (req, res) => {
  const data = await getData();
  const user = data.users[req.params.screen_name];
  if (!user) {
    res.json({ error: 'User not found' });
    return;
  }
  res.json({ user: {
    screen_name: user.screen_name,
    data_dir_name: user.data_dir_name,
  } });
});

app.get('/api/check-password', async (req, res) => {
  const { screen_name, password } = req.query;
  const user = (await getData()).users[screen_name as string];
  if (!user) {
    res.json({ error: 'User not found' });
    return;
  }
  const hash = crypto.createHash(user.password_algorithm).update(password as string || '').digest('hex');
  if (hash !== user.hashed_password) {
    res.json({ result: false });
    return;
  }
  res.json({ result: true });
});

app.post('/api/create-or-update-user', async (req, res) => {
  const { screen_name, password, old_password } = req.query;
  const data = await getData();
  let data_dir_name = generateDataDirName();
  if (data.users[screen_name as string]) {
    const user = data.users[screen_name as string]!;
    const hash = crypto.createHash(user.password_algorithm).update(old_password as string || '').digest('hex');
    if (hash !== user.hashed_password) {
      res.json({ error: 'Old password is incorrect' });
      return;
    }
    data_dir_name = user.data_dir_name;
  }
  const hash = crypto.createHash(PASSWORD_ALGORITHM).update(password as string || '').digest('hex');
  data.users[screen_name as string] = {
    screen_name: String(screen_name),
    password_algorithm: PASSWORD_ALGORITHM,
    hashed_password: hash,
    data_dir_name,
  };
  if (!data.files[data_dir_name]) {
    data.files[data_dir_name] = [];
  }
  const dir = path.join(FILES_DIR_PATH, data_dir_name);
  try {
    await fs.access(dir);
  } catch (e) {
    await fs.mkdir(dir, { recursive: true });
  }
  await saveData(data);
  res.json({ error: null });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { screen_name, password } = req.query;
  const user = (await getData()).users[screen_name as string];
  if (!user) {
    res.json({ error: 'User not found' });
    return;
  }
  const hash = crypto.createHash(user.password_algorithm).update(password as string || '').digest('hex');
  if (hash !== user.hashed_password) {
    res.json({ error: 'Password is incorrect' });
    return;
  }
  if (!req.file) {
    res.json({ error: 'File is not uploaded' });
    return;
  }
  const ext = MIME_WHITELIST[String(req.file.mimetype).toLowerCase()];
  if (!ext) {
    res.json({ error: 'Invalid file type' });
    return;
  }
  const filename = `${crypto.randomBytes(8).toString('hex')}${ext}`;
  const savePath = path.join(FILES_DIR_PATH, user.data_dir_name, filename);
  await fs.writeFile(savePath, req.file.buffer);
  const data = await getData();
  if (!data.files[user.data_dir_name]) {
    data.files[user.data_dir_name] = [];
  }
  data.files[user.data_dir_name]!.push({
    title: req.file.originalname,
    filename,
  });
  await saveData(data);
  await fs.unlink(req.file.path);
  res.json({ error: null });
});

app.get('/api/files/:data_dir_name', async (req, res) => {
  const data = await getData();
  const files = data.files[req.params.data_dir_name];
  if (!files) {
    res.json({ error: 'User not found' });
    return;
  }
  res.json({ files });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
