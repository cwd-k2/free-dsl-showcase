{-# LANGUAGE GADTs #-}

module Dsl.Freer
  ( Freer (..),
    Step (..),
    send,
    ask,
    tell,
    greet,
    view,
    runTalk,
  )
where

import Dsl.Talk (Talk (..), Transcript (..))

-- | An operation and its continuation are separate; f need not be a Functor.
data Freer f a where
  Pure :: a -> Freer f a
  Op :: f x -> (x -> Freer f a) -> Freer f a

instance Functor (Freer f) where
  fmap transform (Pure value) = Pure (transform value)
  fmap transform (Op operation continuation) =
    Op operation (fmap transform . continuation)

instance Applicative (Freer f) where
  pure = Pure
  Pure transform <*> argument = fmap transform argument
  Op operation continuation <*> argument =
    Op operation ((<*> argument) . continuation)

instance Monad (Freer f) where
  Pure value >>= next = next value
  Op operation continuation >>= next =
    Op operation ((>>= next) . continuation)

send :: f a -> Freer f a
send operation = Op operation Pure

ask :: String -> Freer Talk String
ask question = send (Ask question)

tell :: String -> Freer Talk ()
tell message = send (Tell message)

greet :: Freer Talk String
greet = do
  name <- ask "Your name?"
  tell ("Hello, " <> name <> "!")
  pure name

-- | The only two observations the outside interpreter needs.
data Step f a where
  Done :: a -> Step f a
  Await :: f x -> (x -> Freer f a) -> Step f a

view :: Freer f a -> Step f a
view (Pure value) = Done value
view (Op operation continuation) = Await operation continuation

-- | A pure handler written explicitly as a one-operation-at-a-time loop.
runTalk :: [String] -> Freer Talk a -> Either String (Transcript a)
runTalk inputs program =
  case view program of
    Done value -> Right (Transcript value inputs [])
    Await (Ask _question) continuation ->
      case inputs of
        [] -> Left "Talk interpreter has no more input"
        answer : rest -> runTalk rest (continuation answer)
    Await (Tell message) continuation -> do
      transcript <- runTalk inputs (continuation ())
      pure transcript {output = message : output transcript}
