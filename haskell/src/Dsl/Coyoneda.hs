{-# LANGUAGE GADTs #-}

module Dsl.Coyoneda
  ( Coyoneda (..),
    liftCoyoneda,
    lowerCoyoneda,
    freeCoyonedaToFreer,
    freerToFreeCoyoneda,
  )
where

import qualified Dsl.Free as Free
import qualified Dsl.Freer as Freer

-- | Store an f x and postpone mapping x to a. No Functor f instance is needed.
data Coyoneda f a where
  Coyoneda :: (x -> a) -> f x -> Coyoneda f a

instance Functor (Coyoneda f) where
  fmap transform (Coyoneda pending operation) =
    Coyoneda (transform . pending) operation

liftCoyoneda :: f a -> Coyoneda f a
liftCoyoneda = Coyoneda id

lowerCoyoneda :: (Functor f) => Coyoneda f a -> f a
lowerCoyoneda (Coyoneda pending operation) = fmap pending operation

-- | Expanding Free (Coyoneda f) exposes exactly an operation plus a continuation.
freeCoyonedaToFreer :: Free.Free (Coyoneda f) a -> Freer.Freer f a
freeCoyonedaToFreer (Free.Pure value) = Freer.Pure value
freeCoyonedaToFreer (Free.Roll (Coyoneda continuation operation)) =
  Freer.Op operation (freeCoyonedaToFreer . continuation)

freerToFreeCoyoneda :: Freer.Freer f a -> Free.Free (Coyoneda f) a
freerToFreeCoyoneda (Freer.Pure value) = Free.Pure value
freerToFreeCoyoneda (Freer.Op operation continuation) =
  Free.Roll (Coyoneda (freerToFreeCoyoneda . continuation) operation)
