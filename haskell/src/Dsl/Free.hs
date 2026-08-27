{-# LANGUAGE DeriveFunctor #-}

module Dsl.Free
  ( Free (..),
    TalkF (..),
    liftFree,
    ask,
    tell,
    greet,
    runTalk,
  )
where

import Dsl.Talk (Transcript (..))

-- | A free monad stores the rest of the program inside the instruction functor.
data Free f a
  = Pure a
  | Roll (f (Free f a))

instance (Functor f) => Functor (Free f) where
  fmap transform (Pure value) = Pure (transform value)
  fmap transform (Roll operation) = Roll (fmap (fmap transform) operation)

instance (Functor f) => Applicative (Free f) where
  pure = Pure
  Pure transform <*> argument = fmap transform argument
  Roll operation <*> argument = Roll (fmap (<*> argument) operation)

instance (Functor f) => Monad (Free f) where
  Pure value >>= next = next value
  Roll operation >>= next = Roll (fmap (>>= next) operation)

-- | The continuation is part of each operation, making TalkF a Functor.
data TalkF next
  = AskF String (String -> next)
  | TellF String next
  deriving (Functor)

liftFree :: (Functor f) => f a -> Free f a
liftFree operation = Roll (fmap Pure operation)

ask :: String -> Free TalkF String
ask question = liftFree (AskF question id)

tell :: String -> Free TalkF ()
tell message = liftFree (TellF message ())

greet :: Free TalkF String
greet = do
  name <- ask "Your name?"
  tell ("Hello, " <> name <> "!")
  pure name

runTalk :: [String] -> Free TalkF a -> Either String (Transcript a)
runTalk inputs (Pure value) = Right (Transcript value inputs [])
runTalk inputs (Roll (AskF _question continuation)) =
  case inputs of
    [] -> Left "Talk interpreter has no more input"
    answer : rest -> runTalk rest (continuation answer)
runTalk inputs (Roll (TellF message next)) = do
  transcript <- runTalk inputs next
  pure transcript {output = message : output transcript}
