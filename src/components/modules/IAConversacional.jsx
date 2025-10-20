import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Construction } from 'lucide-react';

const IAConversacional = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full p-8 text-center bg-card rounded-xl shadow-lg border"
    >
      <Bot className="w-16 h-16 mb-4 text-primary" />
      <h1 className="text-2xl font-bold text-card-foreground mb-2">IA Conversacional Stout</h1>
      <p className="text-muted-foreground max-w-md">
        Este módulo está em desenvolvimento. Em breve, você poderá conversar com a IA para obter insights e realizar ações no sistema.
      </p>
    </motion.div>
  );
};

export default IAConversacional;