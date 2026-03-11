import express from 'express';

const router = express.Router();

router.get('/', async (req, res) => {
  res.json({ ok: true, route: '__NAME_KEBAB__' });
});

export default router;