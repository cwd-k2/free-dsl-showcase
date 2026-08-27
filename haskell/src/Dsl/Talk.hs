{-# LANGUAGE GADTs #-}

module Dsl.Talk
  ( Talk (..),
    Transcript (..),
  )
where

-- | Operations and their result types, without an interpretation.
data Talk a where
  Ask :: String -> Talk String
  Tell :: String -> Talk ()

-- | Observable result shared by the pure Free and Freer interpreters.
data Transcript a = Transcript
  { result :: a,
    remainingInput :: [String],
    output :: [String]
  }
  deriving (Eq, Show)
