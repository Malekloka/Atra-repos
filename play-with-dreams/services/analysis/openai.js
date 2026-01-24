import config from '../../config.js';
import { OpenAI } from "openai";

const openai = new OpenAI(config.openai);

export default openai;